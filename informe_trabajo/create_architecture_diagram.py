from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"D:\SIGA_WEB\SIGA-Web")
OUTPUT = ROOT / "informe_trabajo" / "assets" / "arquitectura-siga-redisenada.png"

W, H = 1800, 980
NAVY = "#15365D"
BLUE = "#2563EB"
TEAL = "#0F9F9A"
VIOLET = "#6D5AE6"
GREEN = "#2F7D4A"
INK = "#18263D"
MUTED = "#5C6B82"
LINE = "#D7E2F0"
SURFACE = "#FFFFFF"
BG = "#F5F8FC"


def font(size, bold=False):
    name = "seguisb.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path(r"C:\Windows\Fonts") / name), size)


F_TITLE = font(44, True)
F_SUBTITLE = font(21)
F_EYEBROW = font(17, True)
F_CARD = font(25, True)
F_BODY = font(20)
F_BODY_BOLD = font(20, True)
F_SMALL = font(17)
F_SMALL_BOLD = font(17, True)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def shadow(draw, box, radius=28):
    x1, y1, x2, y2 = box
    rounded(draw, (x1 + 7, y1 + 11, x2 + 7, y2 + 11), radius, "#DDE6F2")


def center_text(draw, box, text, text_font, fill):
    x1, y1, x2, y2 = box
    bounds = draw.textbbox((0, 0), text, font=text_font)
    tw, th = bounds[2] - bounds[0], bounds[3] - bounds[1]
    draw.text(((x1 + x2 - tw) / 2, (y1 + y2 - th) / 2 - 2), text, font=text_font, fill=fill)


def draw_people(draw, cx, cy, color):
    draw.ellipse((cx - 15, cy - 23, cx + 15, cy + 7), outline=color, width=5)
    draw.arc((cx - 30, cy + 4, cx + 30, cy + 54), 190, 350, fill=color, width=5)
    draw.ellipse((cx + 27, cy - 15, cx + 45, cy + 3), outline=color, width=4)
    draw.arc((cx + 18, cy + 5, cx + 55, cy + 40), 205, 340, fill=color, width=4)


def draw_browser(draw, cx, cy, color):
    draw.rounded_rectangle((cx - 35, cy - 28, cx + 35, cy + 30), radius=7, outline=color, width=5)
    draw.line((cx - 34, cy - 10, cx + 34, cy - 10), fill=color, width=4)
    for dx in (-23, -11, 1):
        draw.ellipse((cx + dx - 2, cy - 21, cx + dx + 2, cy - 17), fill=color)
    draw.line((cx - 18, cy + 4, cx + 18, cy + 4), fill=color, width=4)
    draw.line((cx - 18, cy + 15, cx + 8, cy + 15), fill=color, width=4)


def draw_api(draw, cx, cy, color):
    draw.line((cx - 34, cy - 27, cx - 51, cy, cx - 34, cy + 27), fill=color, width=6, joint="curve")
    draw.line((cx + 34, cy - 27, cx + 51, cy, cx + 34, cy + 27), fill=color, width=6, joint="curve")
    draw.line((cx + 10, cy - 36, cx - 10, cy + 36), fill=color, width=5)


def draw_database(draw, cx, cy, color):
    draw.ellipse((cx - 37, cy - 29, cx + 37, cy - 8), outline=color, width=5)
    draw.line((cx - 37, cy - 19, cx - 37, cy + 31), fill=color, width=5)
    draw.line((cx + 37, cy - 19, cx + 37, cy + 31), fill=color, width=5)
    draw.arc((cx - 37, cy + 1, cx + 37, cy + 22), 0, 180, fill=color, width=4)
    draw.arc((cx - 37, cy + 20, cx + 37, cy + 41), 0, 180, fill=color, width=5)


def arrow(draw, start, end, color, label):
    x1, y = start
    x2, _ = end
    draw.line((x1, y, x2 - 13, y), fill=color, width=6)
    draw.polygon([(x2 - 13, y - 10), (x2, y), (x2 - 13, y + 10)], fill=color)
    bounds = draw.textbbox((0, 0), label, font=F_SMALL_BOLD)
    tw = bounds[2] - bounds[0]
    pill = ((x1 + x2 - tw) / 2 - 13, y - 48, (x1 + x2 + tw) / 2 + 13, y - 17)
    rounded(draw, pill, 15, "#EDF4FF")
    center_text(draw, pill, label, F_SMALL_BOLD, color)


def tag(draw, x, y, text, color, background):
    bounds = draw.textbbox((0, 0), text, font=F_SMALL_BOLD)
    width = bounds[2] - bounds[0] + 28
    box = (x, y, x + width, y + 34)
    rounded(draw, box, 17, background)
    center_text(draw, box, text, F_SMALL_BOLD, color)
    return width


def card(draw, box, accent, pale, step, title, icon, bullets, tags):
    x1, y1, x2, y2 = box
    shadow(draw, box)
    rounded(draw, box, 28, SURFACE, LINE, 2)
    draw.rounded_rectangle((x1, y1, x2, y1 + 12), radius=10, fill=accent)
    rounded(draw, (x1 + 28, y1 + 34, x1 + 104, y1 + 110), 22, pale)
    icon(draw, x1 + 66, y1 + 72, accent)
    draw.text((x1 + 124, y1 + 39), f"CAPA {step}", font=F_EYEBROW, fill=accent)
    draw.text((x1 + 124, y1 + 69), title, font=F_CARD, fill=INK)
    draw.line((x1 + 28, y1 + 137, x2 - 28, y1 + 137), fill=LINE, width=2)

    y = y1 + 168
    for heading, detail in bullets:
        draw.ellipse((x1 + 30, y + 8, x1 + 40, y + 18), fill=accent)
        draw.text((x1 + 54, y), heading, font=F_BODY_BOLD, fill=INK)
        if detail:
            draw.text((x1 + 54, y + 30), detail, font=F_SMALL, fill=MUTED)
            y += 73
        else:
            y += 43

    tx = x1 + 28
    ty = y2 - 58
    for label in tags:
        used = tag(draw, tx, ty, label, accent, pale)
        tx += used + 8


def build():
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)

    # Encabezado y guía de lectura.
    draw.text((72, 50), "Arquitectura final de SIGA Web", font=F_TITLE, fill=INK)
    draw.text((74, 108), "Flujo seguro desde la experiencia del usuario hasta la persistencia institucional", font=F_SUBTITLE, fill=MUTED)
    rounded(draw, (1450, 52, 1728, 98), 23, "#E8F0FF")
    center_text(draw, (1450, 52, 1728, 98), "FLUJO PRINCIPAL · 4 CAPAS", F_EYEBROW, BLUE)

    y1, y2 = 194, 728
    cards = [
        (70, y1, 420, y2),
        (505, y1, 855, y2),
        (940, y1, 1290, y2),
        (1375, y1, 1725, y2),
    ]
    card(
        draw, cards[0], BLUE, "#EAF2FF", "01", "Usuarios y roles", draw_people,
        [
            ("6 perfiles autorizados", "Administrador · Coordinador"),
            ("Acceso académico", "Docente · Tutor · Estudiante"),
            ("Control institucional", "Apoderado · Vigilante"),
            ("Sesión por alcance", "Menús y datos según rol"),
        ],
        ["NAVEGADOR", "SESIÓN"],
    )
    card(
        draw, cards[1], TEAL, "#E5F7F5", "02", "Experiencia web", draw_browser,
        [
            ("HTML5 + JavaScript", "Interfaz dinámica por módulo"),
            ("CSS3 responsivo", "Escritorio, tableta y móvil"),
            ("64 vistas por rol", "Navegación especializada"),
            ("Consumo de API", "Intercambio mediante JSON"),
        ],
        ["FRONTEND", "HTTPS"],
    )
    card(
        draw, cards[2], VIOLET, "#EFECFF", "03", "Servicios y seguridad", draw_api,
        [
            ("Node.js 18+", "Express 5.3 · 149 rutas API"),
            ("Autenticación", "Sesión, roles y revocación"),
            ("Protección CSRF", "Validación de cada operación"),
            ("Reglas de negocio", "Permisos y alcance académico"),
        ],
        ["API REST", "CONTROL"],
    )
    card(
        draw, cards[3], GREEN, "#EAF6ED", "04", "Persistencia", draw_database,
        [
            ("SQL Server 2025", "Base de datos institucional SIGA"),
            ("28 tablas", "Modelo relacional normalizado"),
            ("Transacciones", "Integridad y consistencia"),
            ("Sincronización", "Procedimientos controlados"),
        ],
        ["MSSQL", "AUDITORÍA"],
    )

    mid_y = (y1 + y2) // 2
    arrow(draw, (420, mid_y), (505, mid_y), BLUE, "HTTPS / JSON")
    arrow(draw, (855, mid_y), (940, mid_y), VIOLET, "API REST")
    arrow(draw, (1290, mid_y), (1375, mid_y), GREEN, "T-SQL")

    # Capacidades transversales.
    shadow(draw, (70, 790, 1725, 918), radius=26)
    rounded(draw, (70, 790, 1725, 918), 26, SURFACE, LINE, 2)
    draw.text((102, 819), "CAPACIDADES TRANSVERSALES", font=F_EYEBROW, fill=NAVY)
    draw.text((102, 852), "Servicios compartidos que respaldan todas las capas", font=F_BODY, fill=MUTED)
    features = [
        ("ExcelJS", "Exportación"),
        ("Multer", "Archivos"),
        ("PDFKit", "Documentos"),
        ("QRCode", "Validación QR"),
        ("E-Tag", "Caché eficiente"),
        ("node:test", "Pruebas"),
    ]
    x = 650
    for tech, label in features:
        rounded(draw, (x, 815, x + 155, 892), 20, "#F4F7FB", LINE, 1)
        center_text(draw, (x, 819, x + 155, 852), tech, F_SMALL_BOLD, NAVY)
        center_text(draw, (x, 850, x + 155, 884), label, F_SMALL, MUTED)
        x += 172

    # Pie descriptivo.
    draw.text((72, 944), "SIGA · Sistema Integrado de Gestión de Asistencia", font=F_SMALL_BOLD, fill=NAVY)
    right = "Autenticación → autorización → reglas de negocio → persistencia"
    bounds = draw.textbbox((0, 0), right, font=F_SMALL)
    draw.text((1728 - (bounds[2] - bounds[0]), 944), right, font=F_SMALL, fill=MUTED)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    build()
