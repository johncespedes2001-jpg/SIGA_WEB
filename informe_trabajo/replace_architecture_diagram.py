from pathlib import Path

from docx import Document

from build_report import patch_missing_alt_text
from update_latest_evidence import replace_picture_before_caption


ROOT = Path(r"D:\SIGA_WEB\SIGA-Web")
DOCUMENT = ROOT / "Informe_SIGA_hasta_punto_8_evidencias_actualizadas.docx"
TEMP = ROOT / "informe_trabajo" / "informe_diagrama_temporal.docx"
DIAGRAM = ROOT / "informe_trabajo" / "assets" / "arquitectura-siga-redisenada.png"


def main():
    document = Document(str(DOCUMENT))
    replace_picture_before_caption(
        document,
        "Figura 1.",
        DIAGRAM,
        "Arquitectura final rediseñada de SIGA Web",
        "Diagrama de cuatro capas: usuarios y roles, experiencia web, servicios y seguridad, y persistencia; incluye tecnologías, controles y capacidades transversales.",
        7.15,
    )
    document.save(str(TEMP))
    patch_missing_alt_text(TEMP)
    TEMP.replace(DOCUMENT)
    print(DOCUMENT)


if __name__ == "__main__":
    main()
