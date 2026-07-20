const fs = require('fs');
const path = require('path');

const src1 = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\7ccd29b6-0a3b-4989-b7db-60bc5788ff86\\vortex_3d_brand_portal_1784559030139.png";
const src2 = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\7ccd29b6-0a3b-4989-b7db-60bc5788ff86\\vortex_3d_coastal_mesh_1784559046027.png";

const destDir = path.join(__dirname, '..', 'frontend', 'public', 'assets');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(src1)) {
  fs.copyFileSync(src1, path.join(destDir, 'vortex_3d_brand_portal.png'));
  console.log('Copied src1 to vortex_3d_brand_portal.png');
}

if (fs.existsSync(src2)) {
  fs.copyFileSync(src2, path.join(destDir, 'vortex_3d_coastal_mesh.png'));
  console.log('Copied src2 to vortex_3d_coastal_mesh.png');
}
