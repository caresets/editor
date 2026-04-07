"""FHIR IG Build Service – FastAPI backend.

Four endpoints that accept a ZIP upload, run a FHIR toolchain command in an
isolated temp directory, and return the output as a ZIP.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
import uuid
import zipfile
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="FHIR IG Build Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten once frontend domain is known
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Bearer token auth (optional — set API_TOKEN env var to enable)
# ---------------------------------------------------------------------------

API_TOKEN = os.getenv("API_TOKEN", "")


async def verify_token(request: Request) -> None:
    if not API_TOKEN:
        return  # auth disabled when no token configured
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {API_TOKEN}":
        raise HTTPException(401, "Invalid or missing Bearer token")

PUBLISHER_JAR = os.getenv("PUBLISHER_JAR", "/app/publisher.jar")
WORK_ROOT = Path(tempfile.gettempdir()) / "fhir-builds"
WORK_ROOT.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_workdir() -> Path:
    d = WORK_ROOT / str(uuid.uuid4())
    d.mkdir(parents=True)
    return d


def _extract_zip(upload: UploadFile, dest: Path) -> None:
    zip_path = dest / "input.zip"
    with open(zip_path, "wb") as f:
        shutil.copyfileobj(upload.file, f)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest / "input")


def _zip_directory(source: Path, zip_path: Path) -> None:
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in source.rglob("*"):
            if file.is_file():
                zf.write(file, file.relative_to(source))


async def _run(cmd: list[str], cwd: Path, timeout: int = 600) -> tuple[int, str]:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    try:
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        raise HTTPException(504, "Build timed out")
    return proc.returncode, stdout.decode(errors="replace")


def _cleanup(workdir: Path) -> None:
    shutil.rmtree(workdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/build", dependencies=[Depends(verify_token)])
async def build(file: UploadFile = File(...)):
    """Run IG Publisher on an uploaded ZIP of IG source."""
    workdir = _make_workdir()
    try:
        _extract_zip(file, workdir)
        input_dir = workdir / "input"
        output_dir = workdir / "output"
        output_dir.mkdir()

        rc, log = await _run(
            [
                "java", "-jar", PUBLISHER_JAR,
                "-ig", str(input_dir),
                "-tx", "n/a",
                "-o", str(output_dir),
            ],
            cwd=input_dir,
            timeout=600,
        )

        if rc != 0:
            raise HTTPException(500, detail=f"IG Publisher failed (exit {rc}):\n{log[-2000:]}")

        out_zip = workdir / "output.zip"
        _zip_directory(output_dir, out_zip)
        return FileResponse(out_zip, media_type="application/zip", filename="ig-output.zip")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    finally:
        # NOTE: FileResponse streams the file, so we schedule cleanup after a delay
        asyncio.get_event_loop().call_later(120, _cleanup, workdir)


@app.post("/sushi", dependencies=[Depends(verify_token)])
async def sushi(file: UploadFile = File(...)):
    """Run SUSHI on an uploaded ZIP of FSH files."""
    workdir = _make_workdir()
    try:
        _extract_zip(file, workdir)
        input_dir = workdir / "input"

        rc, log = await _run(["sushi", str(input_dir)], cwd=input_dir, timeout=120)

        if rc != 0:
            raise HTTPException(500, detail=f"SUSHI failed (exit {rc}):\n{log[-2000:]}")

        generated = input_dir / "fsh-generated"
        if not generated.exists():
            raise HTTPException(500, detail="SUSHI produced no fsh-generated output")

        out_zip = workdir / "output.zip"
        _zip_directory(generated, out_zip)
        return FileResponse(out_zip, media_type="application/zip", filename="fsh-generated.zip")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    finally:
        asyncio.get_event_loop().call_later(120, _cleanup, workdir)


@app.post("/gofsh", dependencies=[Depends(verify_token)])
async def gofsh(file: UploadFile = File(...)):
    """Run GoFSH on an uploaded ZIP of FHIR JSON resources."""
    workdir = _make_workdir()
    try:
        _extract_zip(file, workdir)
        input_dir = workdir / "input"
        output_dir = workdir / "gofsh-output"
        output_dir.mkdir()

        rc, log = await _run(
            ["gofsh", str(input_dir), "-o", str(output_dir)],
            cwd=input_dir,
            timeout=120,
        )

        if rc != 0:
            raise HTTPException(500, detail=f"GoFSH failed (exit {rc}):\n{log[-2000:]}")

        out_zip = workdir / "output.zip"
        _zip_directory(output_dir, out_zip)
        return FileResponse(out_zip, media_type="application/zip", filename="gofsh-output.zip")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    finally:
        asyncio.get_event_loop().call_later(120, _cleanup, workdir)


@app.post("/jekyll", dependencies=[Depends(verify_token)])
async def jekyll(file: UploadFile = File(...)):
    """Run jekyll build on an uploaded ZIP of a Jekyll site."""
    workdir = _make_workdir()
    try:
        _extract_zip(file, workdir)
        input_dir = workdir / "input"

        # Install gems if Gemfile present
        gemfile = input_dir / "Gemfile"
        if gemfile.exists():
            rc, log = await _run(
                ["bundle", "install", "--path", "vendor/bundle"],
                cwd=input_dir,
                timeout=120,
            )
            if rc != 0:
                raise HTTPException(500, detail=f"bundle install failed:\n{log[-2000:]}")

        rc, log = await _run(
            ["bundle", "exec", "jekyll", "build"],
            cwd=input_dir,
            timeout=120,
        )

        if rc != 0:
            raise HTTPException(500, detail=f"Jekyll build failed (exit {rc}):\n{log[-2000:]}")

        site_dir = input_dir / "_site"
        if not site_dir.exists():
            raise HTTPException(500, detail="Jekyll produced no _site output")

        out_zip = workdir / "output.zip"
        _zip_directory(site_dir, out_zip)
        return FileResponse(out_zip, media_type="application/zip", filename="site.zip")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    finally:
        asyncio.get_event_loop().call_later(120, _cleanup, workdir)


# ---------------------------------------------------------------------------
# Validation endpoint (mirrors client-side checks)
# ---------------------------------------------------------------------------

BINDING_TYPES = {"code", "Coding", "CodeableConcept"}
NAME_RE = __import__("re").compile(r"^[a-z][a-zA-Z0-9]*$")


class ElementModel(BaseModel):
    id: str
    name: str
    cardinality: dict
    dataType: str
    vsStrength: str = ""
    valueSet: str = ""
    descriptions: dict
    children: list["ElementModel"] = []


class ValidateRequest(BaseModel):
    elements: list[ElementModel]


@app.post("/validate", dependencies=[Depends(verify_token)])
async def validate_model(req: ValidateRequest):
    results: list[dict] = []

    def walk(el: ElementModel) -> None:
        if not el.name:
            results.append({"level": "error", "elementId": el.id, "message": "Element has no name"})
        elif not NAME_RE.match(el.name):
            results.append({
                "level": "error",
                "elementId": el.id,
                "message": f'"{el.name}" must start lowercase, alphanumeric only',
            })

        if not el.descriptions.get("en"):
            results.append({
                "level": "warning",
                "elementId": el.id,
                "message": f'"{el.name}" is missing English description',
            })

        if el.dataType in BINDING_TYPES and not el.valueSet:
            results.append({
                "level": "warning",
                "elementId": el.id,
                "message": f'"{el.name}" ({el.dataType}) has no ValueSet binding',
            })

        if el.children and el.dataType != "BackboneElement":
            results.append({
                "level": "warning",
                "elementId": el.id,
                "message": f'"{el.name}" has children but type is not BackboneElement',
            })

        min_val = int(el.cardinality.get("min", "0"))
        max_raw = el.cardinality.get("max", "1")
        max_val = float("inf") if max_raw == "*" else int(max_raw)
        if min_val > max_val:
            results.append({
                "level": "error",
                "elementId": el.id,
                "message": f'"{el.name}" has min ({el.cardinality["min"]}) > max ({el.cardinality["max"]})',
            })

        for child in el.children:
            walk(child)

    for el in req.elements:
        walk(el)

    return {"results": results}


@app.get("/health")
async def health():
    return {"status": "ok"}
