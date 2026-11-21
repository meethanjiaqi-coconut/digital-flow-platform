"""One-time extraction from the reviewed application; never writes to the source."""
from pathlib import Path
import shutil, hashlib, json, datetime

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('D:/git_repo/digital-flow-field')
origin = SOURCE / 'tdesign/src/flowfield'
if (ROOT/'baseline/source-manifest.json').exists():
    raise SystemExit('Baseline already exists; extraction is a one-time operation.')
target = ROOT / 'packages/sdk/src/internal'
target.mkdir(parents=True, exist_ok=True)
names = ['FlowFieldData.js', 'flowFieldWorker.js', 'ParticleFlowLayer.js',
 'W3dWaterSurfaceLayer.js', 'flowDynamics.js', 'flowColorRamps.js',
 'waterQualityPresets.js', 'estuaryWaterMaterial.js', 'estuaryVertexShader.js',
 'estuarySceneReflection.js', 'tidal-front-layer.js', 'tidal-front-analysis.js',
 'tidalEvolution.js', 'tidalWaterMix.js', 'waterNormalTexture.js', 'flowTime.js']
records = []
for name in names:
    src = origin / name
    shutil.copy2(src, target / name)
    records.append({'path': str(src.relative_to(SOURCE)).replace('\\','/'),
                    'sha256': hashlib.sha256(src.read_bytes()).hexdigest()})
(ROOT/'baseline').mkdir(exist_ok=True)
for name in names:
    shutil.copy2(origin/name, ROOT/'baseline'/name)
(ROOT/'baseline/source-manifest.json').write_text(json.dumps({
    'source': str(SOURCE), 'createdAt': datetime.datetime.now().astimezone().isoformat(),
    'files': records}, indent=2), encoding='utf-8')
for src, dst in [
 ('tdesign/public/libs/SuperMap3D','local-assets/runtime/SuperMap3D'),
 ('tdesign/public/libs/w3d','local-assets/runtime/w3d'),
 ('output/flowfield-5min-verified','local-assets/data/5min'),
 ('tdesign/public/textures/estuary','packages/sdk/assets/estuary')]:
    shutil.copytree(SOURCE/src, ROOT/dst, dirs_exist_ok=True)
print('Extracted baseline, runtime, textures and 144-frame real dataset into', ROOT)
