const fs = require('fs');
const path = require('path');

const brainDir = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\7ccd29b6-0a3b-4989-b7db-60bc5788ff86";
const destDir = path.join("c:\\Users\\Admin\\Desktop\\mutune", "frontend", "public", "assets");

const images = [
  { src: "hero_coastal_building_1784565819717.png", dest: "hero_coastal_building.png" },
  { src: "mombasa_aerial_coastline_1784565841536.png", dest: "mombasa_aerial_coastline.png" },
  { src: "landlord_property_office_1784565862666.png", dest: "landlord_property_office.png" },
  { src: "tenant_mpesa_payment_1784565884578.png", dest: "tenant_mpesa_payment.png" },
  { src: "agent_field_inspection_1784565906609.png", dest: "agent_field_inspection.png" },
  { src: "building_interior_lobby_1784565927914.png", dest: "building_interior_lobby.png" }
];

let copied = 0;
images.forEach(img => {
  const srcPath = path.join(brainDir, img.src);
  const destPath = path.join(destDir, img.dest);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`✓ ${img.dest}`);
    copied++;
  } else {
    console.log(`✗ NOT FOUND: ${img.src}`);
  }
});
console.log(`\nCopied ${copied}/${images.length} images.`);
