#!/usr/bin/env python3
"""Render an issued KingTurf quote JSON document as a customer-ready PDF."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


GREEN = colors.HexColor("#176846")
INK = colors.HexColor("#263A31")
MUTED = colors.HexColor("#6F7F77")
PALE = colors.HexColor("#F2F6F4")


def money(value: object) -> str:
    return f"{float(str(value)):,.2f}"


def render(source: Path, output: Path) -> None:
    data = json.loads(source.read_text(encoding="utf-8"))
    font_name = "KingTurfChinese"
    pdfmetrics.registerFont(
        TTFont(font_name, "/System/Library/Fonts/STHeiti Light.ttc", subfontIndex=0)
    )
    styles = getSampleStyleSheet()
    normal = ParagraphStyle(
        "ChineseNormal",
        parent=styles["BodyText"],
        fontName=font_name,
        fontSize=9,
        leading=14,
        textColor=INK,
    )
    small = ParagraphStyle(
        "ChineseSmall", parent=normal, fontSize=7.5, leading=11, textColor=MUTED
    )
    heading = ParagraphStyle(
        "ChineseHeading",
        parent=normal,
        fontSize=20,
        leading=25,
        textColor=GREEN,
        spaceAfter=3 * mm,
    )
    amount = ParagraphStyle(
        "Amount", parent=normal, fontSize=16, leading=20, alignment=TA_RIGHT, textColor=GREEN
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=17 * mm,
        title=f"KingTurf Quote {data['quoteNumber']}",
        author="KingTurf Business OS",
    )

    def footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#DCE5E0"))
        canvas.line(18 * mm, 13 * mm, 192 * mm, 13 * mm)
        canvas.setFont(font_name, 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 8 * mm, "金特夫 KingTurf · 系统签发报价")
        canvas.drawRightString(192 * mm, 8 * mm, f"第 {document.page} 页")
        canvas.restoreState()

    story = [
        Table(
            [
                [
                    Paragraph("<b>KINGTURF</b><br/><font size='8'>BUSINESS OS</font>", heading),
                    Paragraph("正式报价单<br/><font size='9'>QUOTATION</font>", amount),
                ]
            ],
            colWidths=[95 * mm, 79 * mm],
        ),
        Spacer(1, 3 * mm),
        Table(
            [
                ["报价编号", data["quoteNumber"], "版本 / 状态", f"R{data['revision']} / {data['status']}"],
                ["客户", data["customerName"], "有效期至", data["validUntil"]],
                ["项目", data["opportunityName"], "币种", data["currency"]],
            ],
            colWidths=[23 * mm, 64 * mm, 24 * mm, 63 * mm],
            style=TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), font_name),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                    ("TEXTCOLOR", (0, 0), (-1, -1), INK),
                    ("BACKGROUND", (0, 0), (0, -1), PALE),
                    ("BACKGROUND", (2, 0), (2, -1), PALE),
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#DCE5E0")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            ),
        ),
        Spacer(1, 7 * mm),
        Paragraph("报价明细", ParagraphStyle("Section", parent=normal, fontSize=12, textColor=GREEN)),
        Spacer(1, 2 * mm),
    ]
    line_rows = [["序号", "产品 / 服务", "数量", "单位", "单价", "金额"]]
    for index, line in enumerate(data["lines"], start=1):
        line_rows.append(
            [
                str(index),
                line["description"],
                money(line["quantity"]),
                line["unitCode"],
                money(line["unitPrice"]),
                money(line["total"]),
            ]
        )
    line_table = Table(line_rows, colWidths=[12 * mm, 65 * mm, 24 * mm, 16 * mm, 28 * mm, 29 * mm], repeatRows=1)
    line_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), font_name),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#DCE5E0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.extend(
        [
            line_table,
            Spacer(1, 5 * mm),
            Table(
                [
                    ["报价小计", f"{data['currency']} {money(data['subtotal'])}"],
                    ["整单折扣", f"- {data['currency']} {money(data['discount'])}"],
                    ["报价总额", f"{data['currency']} {money(data['total'])}"],
                    ["预计毛利", f"{data['currency']} {money(data['margin'])} ({data['marginPercent']})"],
                ],
                colWidths=[38 * mm, 52 * mm],
                hAlign="RIGHT",
                style=TableStyle(
                    [
                        ("FONTNAME", (0, 0), (-1, -1), font_name),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                        ("LINEABOVE", (0, 2), (-1, 2), 0.8, GREEN),
                        ("TEXTCOLOR", (0, 2), (-1, 2), GREEN),
                        ("FONTSIZE", (0, 2), (-1, 2), 12),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ]
                ),
            ),
            Spacer(1, 8 * mm),
            Paragraph("商务条款", ParagraphStyle("Section2", parent=normal, fontSize=12, textColor=GREEN)),
            Spacer(1, 2 * mm),
            Paragraph(data["terms"], normal),
            Spacer(1, 8 * mm),
            Paragraph("系统证据", ParagraphStyle("Section3", parent=normal, fontSize=12, textColor=GREEN)),
            Spacer(1, 2 * mm),
            Table(
                [
                    ["CTR 版本", data["pins"]["ctrVersionId"]],
                    ["技术方案修订", data["pins"]["technicalSolutionRevisionId"]],
                    ["成本决策", data["pins"]["costDecisionId"]],
                    ["销售政策版本", data["pins"]["policyVersionId"]],
                    ["签发快照 SHA-256", data["snapshotHash"]],
                ],
                colWidths=[34 * mm, 140 * mm],
                style=TableStyle(
                    [
                        ("FONTNAME", (0, 0), (-1, -1), font_name),
                        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                        ("BACKGROUND", (0, 0), (0, -1), PALE),
                        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#DCE5E0")),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ]
                ),
            ),
            Spacer(1, 5 * mm),
            Paragraph("本报价由 KingTurf Business OS 根据已批准技术方案、成本决策与销售政策生成；签发版本只读。", small),
        ]
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    render(args.input, args.output)
