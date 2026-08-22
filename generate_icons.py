import os
import math
from PIL import Image, ImageDraw

os.makedirs("src-tauri/icons", exist_ok=True)

def render_instagram_icon(size):
    # Create 4x supersampled image for ultra crisp anti-aliasing
    scale = 4
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    # We will generate a rich Instagram gradient squircle
    # Colors:
    # Yellow: (254, 218, 119) at bottom left
    # Orange: (245, 133, 41)
    # Red/Pink: (221, 42, 123) in middle/diagonal
    # Purple: (129, 52, 175)
    # Blue/Violet: (81, 91, 212) at top right
    
    # Corner radius for squircle / rounded rect
    corner_radius = canvas_size * 0.225
    margin = canvas_size * 0.04
    rect_box = [margin, margin, canvas_size - margin, canvas_size - margin]
    
    # Create gradient background
    grad_img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    
    # Gradient interpolation
    # Bottom-left (0, canvas_size) -> Yellow/Orange
    # Center -> Magenta/Pink
    # Top-right (canvas_size, 0) -> Purple/Blue
    for y in range(canvas_size):
        for x in range(canvas_size):
            # Normalized diagonal: 0 at bottom-left, 1 at top-right
            # u = x / canvas_size, v = (canvas_size - y) / canvas_size
            diag = (x + (canvas_size - y)) / (2.0 * canvas_size)
            
            # Key color stops along diagonal:
            # 0.00: Yellow (254, 218, 119)
            # 0.25: Orange (245, 133, 41)
            # 0.50: Pink/Red (221, 42, 123)
            # 0.75: Purple (129, 52, 175)
            # 1.00: Royal Blue (81, 91, 212)
            
            if diag <= 0.25:
                t = diag / 0.25
                r = int(254 * (1 - t) + 245 * t)
                g = int(218 * (1 - t) + 133 * t)
                b = int(119 * (1 - t) + 41 * t)
            elif diag <= 0.50:
                t = (diag - 0.25) / 0.25
                r = int(245 * (1 - t) + 221 * t)
                g = int(133 * (1 - t) + 42 * t)
                b = int(41 * (1 - t) + 123 * t)
            elif diag <= 0.75:
                t = (diag - 0.50) / 0.25
                r = int(221 * (1 - t) + 129 * t)
                g = int(42 * (1 - t) + 52 * t)
                b = int(123 * (1 - t) + 175 * t)
            else:
                t = (diag - 0.75) / 0.25
                r = int(129 * (1 - t) + 81 * t)
                g = int(52 * (1 - t) + 91 * t)
                b = int(175 * (1 - t) + 212 * t)
                
            grad_img.putpixel((x, y), (r, g, b, 255))
            
    # Mask to rounded rectangle
    mask = Image.new("L", (canvas_size, canvas_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(rect_box, radius=corner_radius, fill=255)
    
    # Composite gradient with mask
    img.paste(grad_img, (0, 0), mask)
    
    # Now draw the camera glyph in crisp white
    draw = ImageDraw.Draw(img)
    
    cx = canvas_size / 2.0
    cy = canvas_size / 2.0
    
    # Camera outer rounded rectangle
    cam_size = canvas_size * 0.54
    cam_margin_x = cx - cam_size / 2.0
    cam_margin_y = cy - cam_size / 2.0
    cam_box = [cam_margin_x, cam_margin_y, cam_margin_x + cam_size, cam_margin_y + cam_size]
    cam_radius = cam_size * 0.28
    cam_stroke = max(int(canvas_size * 0.052), 2)
    
    draw.rounded_rectangle(cam_box, radius=cam_radius, outline=(255, 255, 255, 255), width=cam_stroke)
    
    # Camera center lens (circle)
    lens_radius = cam_size * 0.25
    lens_box = [cx - lens_radius, cy - lens_radius, cx + lens_radius, cy + lens_radius]
    draw.ellipse(lens_box, outline=(255, 255, 255, 255), width=cam_stroke)
    
    # Camera flash / viewfinder dot
    dot_radius = canvas_size * 0.032
    dot_cx = cx + cam_size * 0.27
    dot_cy = cy - cam_size * 0.27
    dot_box = [dot_cx - dot_radius, dot_cy - dot_radius, dot_cx + dot_radius, dot_cy + dot_radius]
    draw.ellipse(dot_box, fill=(255, 255, 255, 255))
    
    return img.resize((size, size), Image.Resampling.LANCZOS)

# Generate multi-resolution icons
print("Generating Instagram Desktop icons...")

icon_512 = render_instagram_icon(512)
icon_512.save("src-tauri/icons/icon.png", "PNG")

icon_256 = render_instagram_icon(256)
icon_256.save("src-tauri/icons/128x128@2x.png", "PNG")

icon_128 = render_instagram_icon(128)
icon_128.save("src-tauri/icons/128x128.png", "PNG")

icon_32 = render_instagram_icon(32)
icon_32.save("src-tauri/icons/32x32.png", "PNG")

# Generate square / UWP logos
square_sizes = [
    ("Square30x30Logo.png", 30),
    ("Square44x44Logo.png", 44),
    ("Square71x71Logo.png", 71),
    ("Square89x89Logo.png", 89),
    ("Square107x107Logo.png", 107),
    ("Square142x142Logo.png", 142),
    ("Square150x150Logo.png", 150),
    ("Square284x284Logo.png", 284),
    ("Square310x310Logo.png", 310),
    ("StoreLogo.png", 50),
]

for filename, sz in square_sizes:
    s_img = render_instagram_icon(sz)
    s_img.save(f"src-tauri/icons/{filename}", "PNG")

# Generate multi-res ICO
ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_imgs = [render_instagram_icon(s[0]) for s in ico_sizes]
ico_imgs[0].save(
    "src-tauri/icons/icon.ico",
    format="ICO",
    sizes=ico_sizes,
    append_images=ico_imgs[1:]
)

# For icns, save 512 png copy
icon_512.save("src-tauri/icons/icon.icns", "PNG")

# Also copy 32x32 / icon to public/ for web app favicon
os.makedirs("public", exist_ok=True)
icon_32.save("public/favicon.ico", "ICO")
icon_512.save("public/icon.png", "PNG")

print("All Instagram Desktop icons successfully generated in src-tauri/icons/ and public/")
