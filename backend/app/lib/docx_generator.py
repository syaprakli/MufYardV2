import base64
import io
import os
import sys
import re
import docx
from docx.shared import Inches, Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def number_to_turkish_words(n):
    units = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]
    tens = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]
    hundreds = ["", "yüz", "iki yüz", "üç yüz", "dört yüz", "beş yüz", "altı yüz", "yedi yüz", "sekiz yüz", "dokuz yüz"]
    
    if n == 0:
        return "sıfır"
        
    words = ""
    if n >= 1000:
        thousands = n // 1000
        words += (number_to_turkish_words(thousands) if thousands > 1 else "") + "bin"
        n %= 1000
    if n >= 100:
        words += hundreds[n // 100]
        n %= 100
    if n >= 10:
        words += tens[n // 10]
        n %= 10
    if n > 0:
        words += units[n]
        
    return words.replace(" ", "")

def set_cell_run_text(cell, text, bold=False, font_size=11, align=None):
    # Clear all paragraphs in the cell
    for p in list(cell.paragraphs):
        pPr = p._element.getparent()
        if pPr is not None:
            pPr.remove(p._element)
            
    p = cell.add_paragraph()
    if align is not None:
        p.alignment = align
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(font_size)
    run.bold = bold

def fill_paragraph_placeholder(p, label, value):
    if label in p.text:
        for run in p.runs:
            if "…" in run.text or "..." in run.text:
                run.text = run.text.replace("…", value).replace("...", value)
                return True
        # fallback
        p.text = p.text.replace("…", value).replace("...", value)
        return True
    return False

def fill_multiple_placeholders(p, values):
    val_idx = 0
    for run in p.runs:
        while val_idx < len(values) and ("…" in run.text or "..." in run.text):
            val_repr = str(values[val_idx]) if values[val_idx] is not None else ""
            if "…" in run.text:
                run.text = run.text.replace("…", val_repr, 1)
            else:
                run.text = run.text.replace("...", val_repr, 1)
            val_idx += 1

def replace_single_placeholder(p, value):
    for run in p.runs:
        if "…" in run.text:
            run.text = run.text.replace("…", value, 1)
            return True
        if "..." in run.text:
            run.text = run.text.replace("...", value, 1)
            return True
    if "…" in p.text or "..." in p.text:
        p.text = p.text.replace("…", value, 1).replace("...", value, 1)
        return True
    return False

def replace_run_text(p, old_text, new_text):
    for run in p.runs:
        if old_text in run.text:
            run.text = run.text.replace(old_text, new_text)
            return True
    return False

def generate_kapak_snapshot_docx(output_path, image_data):
    image_payload = image_data.split(",", 1)[1] if "," in image_data else image_data
    image_bytes = base64.b64decode(image_payload)
    image_stream = io.BytesIO(image_bytes)
    image_stream.seek(0)

    doc = docx.Document()
    section = doc.sections[0]
    section.top_margin = Inches(0)
    section.bottom_margin = Inches(0)
    section.left_margin = Inches(0)
    section.right_margin = Inches(0)
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)

    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.keep_together = True
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER

    run = paragraph.add_run()
    run.add_picture(image_stream, width=section.page_width, height=section.page_height)

    doc.save(output_path)

def fill_signature_block(cell, evaluators):
    if not evaluators:
        return
        
    num_evals = len(evaluators)
    
    # If 1 or 2 evaluators, we keep the original paragraphs and replace runs to preserve template formatting exactly
    if num_evals <= 2 and len(cell.paragraphs) >= 2:
        p_names = cell.paragraphs[0]
        p_titles = cell.paragraphs[1]
        
        name_vals = [
            evaluators[0].get('name', '') if num_evals > 0 else '',
            evaluators[1].get('name', '') if num_evals > 1 else ''
        ]
        
        val_idx = 0
        for run in p_names.runs:
            while val_idx < len(name_vals) and ('…' in run.text or '...' in run.text):
                val_repr = str(name_vals[val_idx]) if name_vals[val_idx] is not None else ''
                if '…' in run.text:
                    run.text = run.text.replace('…', val_repr, 1)
                else:
                    run.text = run.text.replace('...', val_repr, 1)
                val_idx += 1
                    
        title_vals = [
            evaluators[0].get('title', '') if num_evals > 0 else '',
            evaluators[1].get('title', '') if num_evals > 1 else ''
        ]
        
        val_idx = 0
        for run in p_titles.runs:
            if 'Müfettiş' in run.text:
                if val_idx < len(title_vals):
                    run.text = run.text.replace('Müfettiş', title_vals[val_idx])
                    val_idx += 1
    else:
        # Fallback/rebuild for 3+ evaluators
        # Clear paragraphs
        for p in list(cell.paragraphs):
            pPr = p._element.getparent()
            if pPr is not None:
                pPr.remove(p._element)
        cell.add_paragraph()
        
        # Grid layout based on pairs
        import math
        num_rows = math.ceil(num_evals / 2)
        table = cell.add_table(rows=num_rows, cols=2)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = True
        
        tblPr = table._tbl.tblPr
        borders = parse_xml(
            '<w:tblBorders %s>'
            '<w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>'
            '<w:insideH w:val="none"/><w:insideV w:val="none"/>'
            '</w:tblBorders>' % nsdecls('w')
        )
        tblPr.append(borders)
        
        for r_idx in range(num_rows):
            idx1 = r_idx * 2
            idx2 = r_idx * 2 + 1
            
            if idx2 < num_evals:
                # 2 columns in this row
                for idx, ev_idx in enumerate([idx1, idx2]):
                    ev = evaluators[ev_idx]
                    c = table.rows[r_idx].cells[idx]
                    
                    p = c.paragraphs[0]
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    p.paragraph_format.space_before = Pt(6)
                    p.paragraph_format.space_after = Pt(2)
                    
                    run_name = p.add_run(ev.get('name', ''))
                    run_name.font.name = 'Times New Roman'
                    run_name.font.size = Pt(12)
                    run_name.bold = True
                    
                    p_title = c.add_paragraph()
                    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    p_title.paragraph_format.space_before = Pt(0)
                    p_title.paragraph_format.space_after = Pt(6)
                    
                    run_title = p_title.add_run(ev.get('title', ''))
                    run_title.font.name = 'Times New Roman'
                    run_title.font.size = Pt(11)
            else:
                # 1 column (merged) in this row
                c_merge = table.rows[r_idx].cells[0].merge(table.rows[r_idx].cells[1])
                ev = evaluators[idx1]
                
                p = c_merge.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(6)
                p.paragraph_format.space_after = Pt(2)
                
                run_name = p.add_run(ev.get('name', ''))
                run_name.font.name = 'Times New Roman'
                run_name.font.size = Pt(12)
                run_name.bold = True
                
                p_title = c_merge.add_paragraph()
                p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_title.paragraph_format.space_before = Pt(0)
                p_title.paragraph_format.space_after = Pt(6)
                
                run_title = p_title.add_run(ev.get('title', ''))
                run_title.font.name = 'Times New Roman'
                run_title.font.size = Pt(11)


def replace_ellipsis_in_paragraph(p, values):
    val_idx = 0
    for run in p.runs:
        while val_idx < len(values) and ('…' in run.text or '...' in run.text):
            val_repr = str(values[val_idx]) if values[val_idx] is not None else ""
            if '…' in run.text:
                run.text = run.text.replace('…', val_repr, 1)
            else:
                run.text = run.text.replace('...', val_repr, 1)
            val_idx += 1

def generate_kapak_docx(template_path, output_path, data):
    html_snapshot = data.get('htmlSnapshot') or data.get('kapakSnapshot')
    if html_snapshot:
        generate_kapak_snapshot_docx(output_path, html_snapshot)
        return

    doc = docx.Document(template_path)
    
    # 1. Fill standard paragraphs
    for p in doc.paragraphs:
        txt = p.text.strip()
        if "ARŞİV NO:" in txt:
            p.text = f"ARŞİV NO: {data.get('arsivNo', '')}"
            if p.runs:
                p.runs[0].font.name = 'Times New Roman'
                p.runs[0].font.size = Pt(11)
                p.runs[0].bold = True
        elif "Rapor Sayısı:" in txt:
            p.text = f"Rapor Sayısı: {data.get('raporSayisi', '')}"
            if p.runs:
                p.runs[0].font.name = 'Times New Roman'
                p.runs[0].font.size = Pt(11)
                p.runs[0].bold = True
        elif "RAPORU" in txt:
            turu = data.get('raporTuru', '').strip()
            turu_lower = turu.lower()
            if turu_lower.endswith("raporu"):
                turu = turu[:-6].strip()
            elif turu_lower.endswith("rapor"):
                turu = turu[:-5].strip()
            turu = turu.upper()
            replace_single_placeholder(p, turu)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.keep_together = True
            p.paragraph_format.keep_with_next = True
            if p.runs:
                p.runs[0].font.name = 'Times New Roman'
                p.runs[0].font.size = Pt(13 if len(turu) > 10 or '/' in turu else 15)
                p.runs[0].bold = True
        elif "ANKARA" in txt:
            p.text = f"\t\t\t\t\t\t\t\t\t{data.get('yer', '')}"
            if p.runs:
                p.runs[0].font.name = 'Times New Roman'
                p.runs[0].font.size = Pt(11)
                p.runs[0].bold = True
        elif "/" in txt and ("20" in txt or "2X" in txt or "XX" in txt) and not "Rapor" in txt and not "ONAY" in txt and not "GÖREV" in txt:
            p.text = f"\t\t\t\t\t\t\t\t\t{data.get('tarih', '')}"
            if p.runs:
                p.runs[0].font.name = 'Times New Roman'
                p.runs[0].font.size = Pt(11)
                p.runs[0].bold = True

    # 2. Fill Table 1 (Metadata & Signatures & Birim & Konu)
    if len(doc.tables) > 1:
        t1 = doc.tables[1]
        
        # Cell 0 of Row 0 (Metadata cell, vertically merged)
        metadata_cell = t1.rows[0].cells[0]
        for p in metadata_cell.paragraphs:
            txt = p.text
            if "ONAY TARİHİ:" in txt:
                replace_ellipsis_in_paragraph(p, [data.get('onayTarihi', '')])
            elif "ONAY SAYISI:" in txt:
                replace_ellipsis_in_paragraph(p, [data.get('onaySayisi', '')])
            elif "TARİHİ:" in txt and "ONAY" not in txt and "GÖREV" not in txt and "RAPOR" not in txt:
                replace_ellipsis_in_paragraph(p, [data.get('gorevEmriTarihi', '')])
            elif "SAYISI:" in txt and "ONAY" not in txt:
                replace_ellipsis_in_paragraph(p, [data.get('gorevEmriSayisi', '')])
            elif "SAYFA ADEDİ:" in txt:
                replace_ellipsis_in_paragraph(p, [data.get('sayfaAdedi', '')])
            elif "EK ADEDİ:" in txt:
                replace_ellipsis_in_paragraph(p, [data.get('ekAdedi', ''), data.get('ekSayfaAdedi', '')])
                
        # Cell 1 of Row 0: Signatures
        sig_cell = t1.rows[0].cells[1]
        fill_signature_block(sig_cell, data.get('evaluators', []))
        
        # Cell 1 of Row 1: İlgili Birim
        birim_cell = t1.rows[1].cells[1]
        for p in birim_cell.paragraphs:
            if "İlgili Birim:" in p.text:
                replace_ellipsis_in_paragraph(p, [data.get('ilgiliBirim', '')])
                
        # Cell 1 of Row 2: Konu
        konu_cell = t1.rows[2].cells[1]
        for p in konu_cell.paragraphs:
            if "Konu:" in p.text:
                replace_ellipsis_in_paragraph(p, [data.get('konu', '')])


    doc.save(output_path)

def generate_dizi_docx(template_path, output_path, data):
    doc = docx.Document(template_path)
    
    # 1. Update data table (Table 0)
    table = doc.tables[0]
    items = data.get('items', [])
    
    # We want to clear placeholder rows (Row 2, Row 3, Row 4) and insert new ones
    # Row 1 is header, Row 5 (index 4) is TOPLAM.
    # Keep Row 1.
    # Let's delete Row 3 and Row 4 first, then modify Row 2, then insert new rows if needed
    
    # Calculate totals
    total_pages = 0
    for item in items:
        try:
            total_pages += int(item.get('adet', 0) or 0)
        except:
            pass
    total_attachments = len(items)
    
    # Keep the first data row (Row 2) and delete Row 3 & 4 (indexes 2 and 3)
    # Note: after deleting row at index 2, the previous row at index 3 shifts to index 2.
    # We delete twice at index 2.
    tbl = table._tbl
    try:
        tbl.remove(table.rows[3]._tr)
    except:
        pass
    try:
        tbl.remove(table.rows[2]._tr)
    except:
        pass
        
    # Now we have: Row 1 (Header), Row 2 (Data 1), Row 3 (TOPLAM)
    if len(items) == 0:
        # Fill single blank row
        row = table.rows[1]
        for c in row.cells:
            set_cell_run_text(c, "")
    else:
        # Fill Row 2 (index 1) with first item
        item0 = items[0]
        row0 = table.rows[1]
        set_cell_run_text(row0.cells[0], item0.get('siraNo', '1'), align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_run_text(row0.cells[1], item0.get('tarih', ''), align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_run_text(row0.cells[2], item0.get('tarih', ''), align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_run_text(row0.cells[3], item0.get('sayi', ''))
        set_cell_run_text(row0.cells[4], item0.get('adet', ''), align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_run_text(row0.cells[5], item0.get('aciklama', ''))
        
        # Insert and fill other rows
        for idx in range(1, len(items)):
            item = items[idx]
            # Insert a new row XML element before the TOPLAM row (which is at index idx + 1)
            tr_toplam = tbl.tr_lst[idx + 1]
            new_tr = table.add_row()._tr
            tr_toplam.addprevious(new_tr)
            new_row = table.rows[idx + 1]
            
            set_cell_run_text(new_row.cells[0], item.get('siraNo', str(idx + 1)), align=WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_run_text(new_row.cells[1], item.get('tarih', ''), align=WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_run_text(new_row.cells[2], item.get('tarih', ''), align=WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_run_text(new_row.cells[3], item.get('sayi', ''))
            set_cell_run_text(new_row.cells[4], item.get('adet', ''), align=WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_run_text(new_row.cells[5], item.get('aciklama', ''))
            
    # Update TOPLAM row (which is the last row now)
    toplam_row = table.rows[-1]
    set_cell_run_text(toplam_row.cells[0], "", align=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_run_text(toplam_row.cells[1], "", align=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_run_text(toplam_row.cells[2], "TOPLAM", bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT)
    set_cell_run_text(toplam_row.cells[3], "")
    set_cell_run_text(toplam_row.cells[4], str(total_pages), bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_run_text(toplam_row.cells[5], "")
    
    # 2. Update final paragraph
    # "İş bu dizi pusulası (3) adet ek ve 577 (beşyüzyetmişyedi) sayfadan ibarettir."
    words = number_to_turkish_words(total_pages)
    for p in doc.paragraphs:
        if "dizi pusulası" in p.text and "sayfadan ibarettir" in p.text:
            p.text = f"İş bu dizi pusulası ({total_attachments}) adet ek ve {total_pages} ({words}) sayfadan ibarettir."
            p.runs[0].font.name = 'Times New Roman'
            p.runs[0].font.size = Pt(11)
            p.runs[0].bold = True
            
    # 3. Update signatures (Table 1)
    sig_table = doc.tables[1]
    evaluators = data.get('evaluators', [])
    num_evals = len(evaluators)
    
    # Rebuild signature rows:
    # First, clear all rows from the table
    while len(sig_table.rows) > 0:
        tbl = sig_table._tbl
        tbl.remove(sig_table.rows[-1]._tr)
        
    # Rebuild signature rows in pairs:
    # Each pair takes 2 rows: one for name, one for title
    import math
    num_pairs = math.ceil(num_evals / 2)
    for pair_idx in range(num_pairs):
        row_names = sig_table.add_row()
        row_titles = sig_table.add_row()
        
        idx1 = pair_idx * 2
        idx2 = pair_idx * 2 + 1
        
        if idx2 < num_evals:
            set_cell_run_text(row_names.cells[0], evaluators[idx1].get('name', ''), bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_run_text(row_titles.cells[0], evaluators[idx1].get('title', ''), align=WD_ALIGN_PARAGRAPH.CENTER)
            
            set_cell_run_text(row_names.cells[1], evaluators[idx2].get('name', ''), bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_run_text(row_titles.cells[1], evaluators[idx2].get('title', ''), align=WD_ALIGN_PARAGRAPH.CENTER)
        else:
            c_name = row_names.cells[0].merge(row_names.cells[1])
            c_title = row_titles.cells[0].merge(row_titles.cells[1])
            
            set_cell_run_text(c_name, evaluators[idx1].get('name', ''), bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_run_text(c_title, evaluators[idx1].get('title', ''), align=WD_ALIGN_PARAGRAPH.CENTER)
        
    doc.save(output_path)

def generate_evrak_talebi_docx(template_path, output_path, data):
    """
    Teftiş Öncesi Hazırlanılması İstenilen Hususlar (Evrak Talebi) belgesini 
    seçili maddelere göre dinamik olarak üretir.
    """
    doc = docx.Document()
    
    # Set page margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)
        
    # Styles
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(11)
    
    # 1. Header
    p_header = doc.add_paragraph()
    p_header.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_header = p_header.add_run(
        "T.C.\n"
        "GENÇLİK VE SPOR BAKANLIĞI\n"
        "Rehberlik ve Teftiş Başkanlığı"
    )
    r_header.bold = True
    r_header.font.size = Pt(12)
    p_header.paragraph_format.space_after = Pt(24)
    
    # 2. Letter Info / Olur & Görev Emri
    olur_t = data.get("olurTarihi") or "......."
    olur_s = data.get("olurSayisi") or "......."
    gorev_t = data.get("gorevTarihi") or "......."
    gorev_s = data.get("gorevSayisi") or "......."
    muf_name = data.get("mufettisAdi") or "......."
    muf_title = data.get("mufettisUnvani") or "Müfettiş"
    denetim_donemi = data.get("denetimDonemi") or "01.03.2016 - 31.12.2025"
    denetim_yili = data.get("denetimYili") or "2016-2025"
    donem_musabaka = data.get("donemMusabaka") or "01.01.2020 - 31.12.2025"
    teslim_suresi = data.get("teslimSuresi") or "7"
    
    # 3. Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = p_title.add_run("TEFTİŞ ÖNCESİ HAZIRLANILMASI İSTENİLEN HUSUSLAR")
    r_title.bold = True
    r_title.font.size = Pt(13)
    r_title.underline = True
    p_title.paragraph_format.space_after = Pt(18)
    
    # 4. Intro Paragraph
    p_intro = doc.add_paragraph()
    r_intro = p_intro.add_run(
        f"Bakanlık Makamının {olur_t} tarihli ve {olur_s} sayılı Olurları ile Rehberlik ve Teftiş Başkanlığının "
        f"{gorev_t} tarihli ve {gorev_s} sayılı görev emirleri uyarınca, {denetim_donemi} dönemine ilişkin "
        f"il müdürlüğü faaliyetlerinin teftişi amacıyla aşağıda belirtilen bilgi ve belgelerin teftiş grubumuza "
        f"göreve başlandığı tarihten itibaren en geç {teslim_suresi} gün içerisinde teslim edilmesi gerekmektedir."
    )
    p_intro.paragraph_format.space_after = Pt(12)
    p_intro.paragraph_format.line_spacing = 1.15
    
    # 5. Selected Items List
    selected_items = data.get("selectedItemsText", [])
    
    for idx, item_text in enumerate(selected_items):
        p_item = doc.add_paragraph()
        p_item.paragraph_format.line_spacing = 1.15
        p_item.paragraph_format.space_after = Pt(8)
        p_item.paragraph_format.left_indent = Inches(0.25)
        
        # Replace variables inside item_text
        final_text = item_text
        final_text = final_text.replace("{donem}", denetim_donemi)
        final_text = final_text.replace("{yillar}", denetim_yili)
        final_text = final_text.replace("{donemMusabaka}", donem_musabaka)
        
        # Format as numbered list
        r_num = p_item.add_run(f"{idx+1}. ")
        r_num.bold = True
        p_item.add_run(final_text)
        
        # Insert associated tables if specific text matches
        # Table 1: Kiraya verilen tesisler
        if "kiraya verilen" in final_text.lower() and "otopark" in final_text.lower():
            # Add sublist paragraph
            p_sub = doc.add_paragraph()
            p_sub.paragraph_format.left_indent = Inches(0.5)
            p_sub.paragraph_format.space_after = Pt(4)
            p_sub.add_run("Listede aşağıdaki bilgilere de yer verilmelidir:").italic = True
            
            # Add table
            headers = ['Kiraya verilen tesisin adı', 'Müstecirin adı', 'Kiraladığı Tarih', 'Kiraya verildiği dönem', 'Yıllık Kira Tutarı', 'Tahsil edilen Kira Bedeli', 'Tahsil Edilmeyen Kira Bedeli', 'Açıklama']
            create_evrak_table(doc, headers, 3)
            
        # Table 2: İhaleler
        elif "ihale" in final_text.lower() and "doğrudan temin" not in final_text.lower():
            headers = ['Sıra No', 'İhalenin Adı', 'İhaleyi Alan Firma', 'İhalenin Tarihi', 'İhalenin Usulü', 'İhale Bedeli']
            create_evrak_table(doc, headers, 3)
            
        # Table 3: Doğrudan temin
        elif "doğrudan temin" in final_text.lower():
            headers = ['Sıra No', 'Alım Yapılan Firma', 'Alımın Adı ve Konusu', 'Alımın Tarihi', 'Alım Usulü', 'Alım Bedeli']
            create_evrak_table(doc, headers, 3)

    # 6. Signatures (At the end)
    p_space = doc.add_paragraph()
    p_space.paragraph_format.space_before = Pt(36)
    
    p_sig = doc.add_paragraph()
    p_sig.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_sig_name = p_sig.add_run(f"{muf_name}\n")
    r_sig_name.bold = True
    r_sig_title = p_sig.add_run(f"{muf_title}")
    
    doc.save(output_path)

def create_evrak_table(doc, headers, num_rows):
    # Add an empty paragraph before table
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    
    table = doc.add_table(rows=num_rows, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    
    # Set headers
    hdr_cells = table.rows[0].cells
    for idx, name in enumerate(headers):
        hdr_cells[idx].text = name
        # Bold header
        hdr_cells[idx].paragraphs[0].runs[0].font.bold = True
        hdr_cells[idx].paragraphs[0].runs[0].font.size = Pt(9)
        hdr_cells[idx].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Shading header xml
        shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="F2F2F2"/>')
        hdr_cells[idx]._tc.get_or_add_tcPr().append(shading_elm)
        
    # Format data rows
    for r_idx in range(1, num_rows):
        row = table.rows[r_idx]
        for cell in row.cells:
            # set margins or small text
            cell.text = ""
            cell.paragraphs[0].paragraph_format.space_after = Pt(2)
            
    # Set grid borders
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        '<w:tblBorders %s>'
        '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        '</w:tblBorders>' % nsdecls('w')
    )
    tblPr.append(borders)
    
    # Space after table
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(4)
    p_after.paragraph_format.space_after = Pt(4)

def generate_degerlendirme_docx(output_path, data):
    from docx import Document
    from docx.shared import Pt, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
    from docx.oxml import parse_xml
    from docx.oxml.ns import nsdecls
    
    doc = Document()
    
    # Page setup
    section = doc.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)
    
    # EK-1 Ref
    p_ref = doc.add_paragraph()
    p_ref.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run_ref = p_ref.add_run("EK-1")
    run_ref.font.name = "Times New Roman"
    run_ref.font.size = Pt(11)
    run_ref.bold = True
    
    # Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_title = p_title.add_run("MÜFETTİŞ YARDIMCISI DEĞERLENDİRME FORMU")
    run_title.font.name = "Times New Roman"
    run_title.font.size = Pt(14)
    run_title.bold = True
    p_title.paragraph_format.space_before = Pt(12)
    p_title.paragraph_format.space_after = Pt(24)
    
    # Form Meta (Evaluated & Date)
    meta_table = doc.add_table(rows=3, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False
    
    for row in meta_table.rows:
        row.cells[0].width = Inches(4.5)
        row.cells[1].width = Inches(2.2)
        
    c0 = meta_table.cell(0, 0)
    p = c0.paragraphs[0]
    r = p.add_run("DEĞERLENDİRİLEN")
    r.bold = True
    r.font.name = "Times New Roman"
    r.font.size = Pt(11)
    
    c1 = meta_table.cell(0, 1)
    p = c1.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run(f"TARİH: {data.get('date', '')}")
    r.bold = True
    r.font.name = "Times New Roman"
    r.font.size = Pt(11)
    
    c2 = meta_table.cell(1, 0)
    p = c2.paragraphs[0]
    r = p.add_run(f"ADI SOYADI: {data.get('fullName', '')}")
    r.font.name = "Times New Roman"
    r.font.size = Pt(11)
    
    c3 = meta_table.cell(2, 0)
    p = c3.paragraphs[0]
    r = p.add_run(f"UNVANI: {data.get('title', '')}")
    r.font.name = "Times New Roman"
    r.font.size = Pt(11)
    
    # Add borderless style for meta table
    tblPr = meta_table._tbl.tblPr
    borders = parse_xml(
        '<w:tblBorders %s>'
        '<w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>'
        '<w:insideH w:val="none"/><w:insideV w:val="none"/>'
        '</w:tblBorders>' % nsdecls('w')
    )
    tblPr.append(borders)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    
    # Criteria Table
    criteria = [
      "Takım Çalışmasına Yatkınlığı", "Motivasyon Seviyesi (görevine bağlılığı, iş heyecanı)", "Stresle Başa Çıkma Düzeyi", "Kendini Yazılı ve Sözlü İfade Becerisi", "Disipline Riayeti", "Uyumluluğu (işbirliği yapmada ve değişen şartlara, görevlere uyumda gösterdiği başarı)", "Mesai Saatlerine Riayeti", "Sosyal ve Beşeri İlişkileri", "Mesleki ve Kişisel Gelişme İçin Harcadığı Çaba", "Mesleki Temsil Becerisi (protokol kurallarına uyma, kılık kıyafet seçimi, tutum ve davranışları)", "Verilen İşi Zamanında ve Kusursuz, Uygun, Eksiksiz Yerine Getirme Becerisi"
    ]
    
    table = doc.add_table(rows=12, cols=4)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = 'Table Grid'
    
    hdr_cells = table.rows[0].cells
    hdr_cells[0].width = Inches(3.7)
    hdr_cells[1].width = Inches(1.0)
    hdr_cells[2].width = Inches(1.0)
    hdr_cells[3].width = Inches(1.0)
    
    headers = ["DEĞERLENDİRME KRİTERLERİ", "ÇOK İYİ", "İYİ", "GELİŞTİRMELİ"]
    for idx, h in enumerate(headers):
        p = hdr_cells[idx].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h)
        r.bold = True
        r.font.name = "Times New Roman"
        r.font.size = Pt(9.5)
        
    ratings_map = data.get('ratings', {})
    for i, crit_text in enumerate(criteria):
        row_cells = table.rows[i+1].cells
        row_cells[0].width = Inches(3.7)
        row_cells[1].width = Inches(1.0)
        row_cells[2].width = Inches(1.0)
        row_cells[3].width = Inches(1.0)
        
        p = row_cells[0].paragraphs[0]
        r = p.add_run(crit_text)
        r.font.name = "Times New Roman"
        r.font.size = Pt(9.5)
        
        selected_rating = ratings_map.get(str(i))
        for r_idx in range(3):
            p_choice = row_cells[r_idx + 1].paragraphs[0]
            p_choice.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if selected_rating is not None and str(selected_rating) == str(r_idx):
                r_tick = p_choice.add_run("✓")
                r_tick.bold = True
                r_tick.font.name = "Times New Roman"
                r_tick.font.size = Pt(12)
                
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    
    # Explanation
    p_notes_lbl = doc.add_paragraph()
    r = p_notes_lbl.add_run("AÇIKLAMA:")
    r.bold = True
    r.font.name = "Times New Roman"
    r.font.size = Pt(10)
    p_notes_lbl.paragraph_format.space_after = Pt(2)
    
    p_notes = doc.add_paragraph()
    r = p_notes.add_run(data.get('notes', ''))
    r.font.name = "Times New Roman"
    r.font.size = Pt(10)
    p_notes.paragraph_format.space_after = Pt(18)
    
    # Evaluator Table (Right Aligned)
    eval_table = doc.add_table(rows=4, cols=1)
    eval_table.alignment = WD_TABLE_ALIGNMENT.RIGHT
    
    # Add borderless style for evaluator table
    tblPr = eval_table._tbl.tblPr
    borders = parse_xml(
        '<w:tblBorders %s>'
        '<w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>'
        '<w:insideH w:val="none"/><w:insideV w:val="none"/>'
        '</w:tblBorders>' % nsdecls('w')
    )
    tblPr.append(borders)
    
    p = eval_table.cell(0, 0).paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("DEĞERLENDİREN")
    r.bold = True
    r.font.name = "Times New Roman"
    r.font.size = Pt(10.5)
    
    p = eval_table.cell(1, 0).paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(data.get('evaluatorName', ''))
    r.bold = True
    r.font.name = "Times New Roman"
    r.font.size = Pt(10.5)
    
    p = eval_table.cell(2, 0).paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(data.get('evaluatorTitle', ''))
    r.font.name = "Times New Roman"
    r.font.size = Pt(10)
    
    p = eval_table.cell(3, 0).paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(f"\n{data.get('signature', '')}")
    r.font.name = "Times New Roman"
    r.font.size = Pt(10)
    
    eval_table.rows[0].cells[0].width = Inches(3.0)
    
    doc.save(output_path)


def generate_ozet_tablolar_docx(output_path, data):
    """
    Gençlik ve Spor İl Müdürlüğü Özet Bilgiler (Müfettiş Özet Bilgiler) Word belgesini
    15 ana başlık ve dinamik tablolar halinde oluşturur.
    """
    doc = docx.Document()
    
    # Sayfa kenar boşlukları (0.75 inç - tabloların rahat sığması için)
    # Sayfa ve Kağıt Boyutu: Standart Resmi A4 (21 x 29.7 cm, code="9") ve 2.5 cm kenar boşlukları
    for section in doc.sections:
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)
        
        # Word'ün kağıt boyutunu doğrudan resmi "A4" olarak tanıması için code="9" ve orient="portrait" ekle
        sectPr = section._sectPr
        pgSz = sectPr.find(qn('w:pgSz'))
        if pgSz is not None:
            pgSz.set(qn('w:code'), '9')
            pgSz.set(qn('w:w'), '11906')
            pgSz.set(qn('w:h'), '16838')
            pgSz.set(qn('w:orient'), 'portrait')
        
    style = doc.styles['Normal']
    style.font.name = 'Times New Roman'
    style.font.size = Pt(10)

    def set_cell_width(cell, width_cm):
        cell.width = width_cm
        tcPr = cell._tc.get_or_add_tcPr()
        dxa = int(width_cm.inches * 1440)
        tcW = parse_xml(f'<w:tcW {nsdecls("w")} w:w="{dxa}" w:type="dxa"/>')
        existing_tcW = tcPr.find(qn('w:tcW'))
        if existing_tcW is not None:
            tcPr.remove(existing_tcW)
        tcPr.append(tcW)
    
    def apply_table_style(table, col_widths=None):
        tblPr = table._tbl.tblPr
        borders = parse_xml(
            '<w:tblBorders %s>'
            '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
            '</w:tblBorders>' % nsdecls('w')
        )
        tblPr.append(borders)
        
        # Sola dayalı: Başlıklarla (1- SPORCU SAYILARI vb.) tam aynı hizada başlar
        table.alignment = WD_TABLE_ALIGNMENT.LEFT
        table.autofit = False

        # Tablo genişliğini sayfa metin alanına (16.0 cm = 9072 dxa) tam yay
        existing_tblW = tblPr.find(qn('w:tblW'))
        if existing_tblW is not None:
            tblPr.remove(existing_tblW)
        tblW = parse_xml(f'<w:tblW {nsdecls("w")} w:w="9072" w:type="dxa"/>')
        tblPr.append(tblW)

        # Sütun genişliklerini uygula
        if col_widths and len(col_widths) == len(table.columns):
            for row in table.rows:
                for idx, width in enumerate(col_widths):
                    if idx < len(row.cells):
                        set_cell_width(row.cells[idx], width)
        else:
            num_cols = len(table.columns)
            if num_cols > 0:
                eq_w = Cm(16.0 / num_cols)
                for row in table.rows:
                    for cell in row.cells:
                        set_cell_width(cell, eq_w)
        
        # Header shading
        for cell in table.rows[0].cells:
            shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="F2F2F2"/>')
            cell._tc.get_or_add_tcPr().append(shd)

    def add_section_header(title):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(title)
        run.bold = True
        run.font.size = Pt(11)
        run.font.name = 'Times New Roman'
        return p

    def add_note(note_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run(note_text)
        run.italic = True
        run.font.size = Pt(8.5)
        run.font.name = 'Times New Roman'

    import datetime
    cur_year = datetime.datetime.now().year
    def_end = cur_year - 1
    def_start = cur_year - 5
    def_years = [str(y) for y in range(def_start, def_end + 1)]

    TURKISH_PROVINCES = [
        "ADANA", "ADIYAMAN", "AFYONKARAHİSAR", "AĞRI", "AKSARAY", "AMASYA", "ANKARA", "ANTALYA", 
        "ARDAHAN", "ARTVİN", "AYDIN", "BALIKESİR", "BARTIN", "BATMAN", "BAYBURT", "BİLECİK", 
        "BİNGÖL", "BİTLİS", "BOLU", "BURDUR", "BURSA", "ÇANAKKALE", "ÇANKIRI", "ÇORUM", 
        "DENİZLİ", "DİYARBAKIR", "DÜZCE", "EDİRNE", "ELAZIĞ", "ERZİNCAN", "ERZURUM", "ESKİŞEHİR", 
        "GAZİANTEP", "GİRESUN", "GÜMÜŞHANE", "HAKKARİ", "HATAY", "IĞDIR", "ISPARTA", "İSTANBUL", 
        "İZMİR", "KAHRAMANMARAŞ", "KARABÜK", "KARAMAN", "KARS", "KASTAMONU", "KAYSERİ", "KIRIKKALE", 
        "KIRKLARELİ", "KIRŞEHİR", "KİLİS", "KOCAELİ", "KONYA", "KÜTAHYA", "MALATYA", "MANİSA", 
        "MARDİN", "MERSİN", "MUĞLA", "MUŞ", "NEVŞEHİR", "NİĞDE", "ORDU", "OSMANİYE", 
        "RİZE", "SAKARYA", "SAMSUN", "SİİRT", "SİNOP", "SİVAS", "ŞANLIURFA", "ŞIRNAK", 
        "TEKİRDAĞ", "TOKAT", "TRABZON", "TUNCELİ", "UŞAK", "VAN", "YALOVA", "YOZGAT", "ZONGULDAK"
    ]

    raw_il = (data.get("ilAdi") or "VAN").strip()
    text_norm = raw_il.upper().replace('i', 'İ').replace('ı', 'I')
    
    matched_city = None
    for prov in sorted(TURKISH_PROVINCES, key=len, reverse=True):
        pattern = r'(?<![A-ZÇĞİÖŞÜ])' + prov + r'(?![A-ZÇĞİÖŞÜ])'
        if re.search(pattern, text_norm):
            matched_city = prov
            break

    if matched_city:
        header_il_line = f"{matched_city} GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ"
    else:
        cleaned_il = re.sub(r'^\s*\d+\s*[-–.]\s*', '', text_norm)
        for bad in ['GENEL RAPORU', 'RAPORU', 'RAPOR', 'GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ', 'GENCLIK VE SPOR IL MUDURLUGU', 'İL MÜDÜRLÜĞÜ', 'IL MUDURLUGU', 'DENETİMİ', 'DENETİM']:
            cleaned_il = cleaned_il.replace(bad, '')
        cleaned_il = re.sub(r'\d+$', '', cleaned_il).strip(' -–.')
        if not cleaned_il:
            cleaned_il = "VAN"
        header_il_line = f"{cleaned_il} GENÇLİK VE SPOR İL MÜDÜRLÜĞÜ"

    donem = data.get("denetimDonemi") or f"{def_start} - {def_end}"
    years = [str(y) for y in data.get("years", def_years)]
    has_pre = any(int(y) <= 2018 for y in years)
    has_post = any(int(y) >= 2019 for y in years)
    is_split = has_pre and has_post
    pre_years = [y for y in years if int(y) <= 2018]
    post_years = [y for y in years if int(y) >= 2019]

    tables_data = data.get("tables", {})

    # Başlık
    p_head = doc.add_paragraph()
    p_head.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_head.paragraph_format.space_after = Pt(14)
    r = p_head.add_run(
        "T.C.\n"
        "GENÇLİK VE SPOR BAKANLIĞI\n"
        "Rehberlik ve Teftiş Başkanlığı\n\n"
        f"{header_il_line}\n"
        f"ÖZET BİLGİLER ( {donem} )\n"
    )
    r.bold = True
    r.font.size = Pt(12)
    r.font.name = 'Times New Roman'

    # 1- SPORCU SAYILARI
    add_section_header("1- SPORCU SAYILARI:")
    sporcu_rows = [
        ("lisansli", "Lisanslı Sporcu Sayısı (Bayan/Bay)"),
        ("faal", "Faal (Bayan/Bay)"),
        ("milli", "Milli Olmuş Sporcu Sayısı"),
        ("turkiye1", "Türkiye 1'incisi Olmuş Sporcu Sayısı (1)"),
        ("ulusalDerece", "Ulusal Derece Alan Sporcu Sayısı (1)"),
        ("uluslararasiDerece", "Uluslararası Derece Alan Sporcu Sayısı (2)")
    ]
    for c_row in tables_data.get("customSporcuRows", []):
        sporcu_rows.append((c_row, c_row))
    t1 = doc.add_table(rows=len(sporcu_rows) + 1, cols=len(years) + 1)
    t1_widths = [Cm(5.5)] + [Cm((16.0 - 5.5) / max(1, len(years)))] * len(years)
    apply_table_style(t1, t1_widths)
    set_cell_run_text(t1.cell(0, 0), "GÖSTERGE", bold=True, font_size=9, align=WD_ALIGN_PARAGRAPH.CENTER)
    for i, yr in enumerate(years):
        set_cell_run_text(t1.cell(0, i + 1), yr, bold=True, font_size=9, align=WD_ALIGN_PARAGRAPH.CENTER)
    
    sporcu_data = tables_data.get("sporcuSayilari", {})
    for r_idx, (k, label) in enumerate(sporcu_rows):
        set_cell_run_text(t1.cell(r_idx + 1, 0), label, bold=False, font_size=8.5)
        row_vals = sporcu_data.get(k, {})
        for c_idx, yr in enumerate(years):
            val = str(row_vals.get(yr, ""))
            set_cell_run_text(t1.cell(r_idx + 1, c_idx + 1), val, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_note("(1),(2) Branş belirtilecek. Ek 1")

    # 2- ANTRENÖR DURUMU
    add_section_header("2- ANTRENÖR DURUMU:")
    default_branches = [
        "ATICILIK", "ATLETİZM", "BADMİNTON", "BASKETBOL", "BED. ENG. TENİS", "BİSİKLET", "BOCCE", "BOKS",
        "BUZ HOKEYİ", "BUZ PATENİ", "CİMNASTİK", "CURLİNG", "DART", "ESKRİM", "FUTBOL", "GOALBALL",
        "GÖRME ENG. FUTBOL", "GÜREŞ", "HALTER", "HENTBOL", "HOKEY", "JUDO", "KARATE", "KAYAK",
        "KİCK-BOX", "KÜREK", "MODERN PENTATLON", "MASA TENİSİ", "MUAY-TAİ", "OKÇULUK", "TAEKWONDO",
        "TENİS", "VOLEYBOL", "WUSHU", "YÜZME"
    ]
    ant_branches = tables_data.get("customBranches") or default_branches
    antrenor_data = tables_data.get("antrenorDurumu", [])
    ant_dict = {item.get("branch"): item for item in antrenor_data if isinstance(item, dict)}

    t2 = doc.add_table(rows=len(ant_branches) + 2, cols=5)
    apply_table_style(t2, [Cm(6.0), Cm(2.5), Cm(2.5), Cm(2.5), Cm(2.5)])
    headers2 = ["BRANŞI", "FAHRİ", "KADROLU", "SÖZLEŞMELİ", "TOPLAM"]
    for i, h in enumerate(headers2):
        set_cell_run_text(t2.cell(0, i), h, bold=True, font_size=9, align=WD_ALIGN_PARAGRAPH.CENTER)
    
    tot_fahri, tot_kadrolu, tot_sozlesmeli, tot_all = 0, 0, 0, 0
    for r_idx, br in enumerate(ant_branches):
        item = ant_dict.get(br, {})
        f_val = str(item.get("fahri", ""))
        k_val = str(item.get("kadrolu", ""))
        s_val = str(item.get("sozlesmeli", ""))
        
        # Calculate row total if numbers
        row_tot = 0
        has_num = False
        for v in (f_val, k_val, s_val):
            if v and v.isdigit():
                row_tot += int(v)
                has_num = True
        t_val = str(row_tot) if has_num else ""
        
        if f_val.isdigit(): tot_fahri += int(f_val)
        if k_val.isdigit(): tot_kadrolu += int(k_val)
        if s_val.isdigit(): tot_sozlesmeli += int(s_val)
        if has_num: tot_all += row_tot

        set_cell_run_text(t2.cell(r_idx + 1, 0), br, font_size=8)
        set_cell_run_text(t2.cell(r_idx + 1, 1), f_val, font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_run_text(t2.cell(r_idx + 1, 2), k_val, font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_run_text(t2.cell(r_idx + 1, 3), s_val, font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_run_text(t2.cell(r_idx + 1, 4), t_val, font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)

    # Toplam satırı
    last_r = len(ant_branches) + 1
    set_cell_run_text(t2.cell(last_r, 0), "TOPLAM", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.RIGHT)
    set_cell_run_text(t2.cell(last_r, 1), str(tot_fahri) if tot_fahri else "", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_run_text(t2.cell(last_r, 2), str(tot_kadrolu) if tot_kadrolu else "", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_run_text(t2.cell(last_r, 3), str(tot_sozlesmeli) if tot_sozlesmeli else "", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_run_text(t2.cell(last_r, 4), str(tot_all) if tot_all else "", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)

    # 3- HAKEM DURUMU
    add_section_header("3- HAKEM DURUMU:")
    hakem_data = tables_data.get("hakemDurumu", {})
    h_rows = [
        ("aday", "Aday (1)"), ("bolge", "Bölge (1)"), ("milli", "Milli (1)"),
        ("ulusal", "Ulusal (1)"), ("uluslararasi", "Uluslararası (1)")
    ]
    for c_row in tables_data.get("customHakemRows", []):
        h_rows.append((c_row, c_row))
    h_rows.append(("toplam", "Toplam"))
    t3 = doc.add_table(rows=len(h_rows) + 1, cols=2)
    apply_table_style(t3, [Cm(10.0), Cm(6.0)])
    set_cell_run_text(t3.cell(0, 0), "KATEGORİ", bold=True, font_size=9)
    set_cell_run_text(t3.cell(0, 1), "SAYI", bold=True, font_size=9, align=WD_ALIGN_PARAGRAPH.CENTER)
    for idx, (hk, hlbl) in enumerate(h_rows):
        set_cell_run_text(t3.cell(idx + 1, 0), hlbl, bold=(hk == "toplam"), font_size=8.5)
        set_cell_run_text(t3.cell(idx + 1, 1), str(hakem_data.get(hk, "")), bold=(hk == "toplam"), font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_note("Branşları belirtilecektir. Ek 2")

    # 4- KULÜP SAYILARI
    add_section_header("4- KULÜP SAYILARI:")
    kulup_data = tables_data.get("kulupSayilari", {})
    k_rows = [("faalKulup", "Faal Kulüp Sayısı"), ("faalBrans", "Faal Branş Sayısı (1)")]
    for c_row in tables_data.get("customKulupRows", []):
        k_rows.append((c_row, c_row))
    t4 = doc.add_table(rows=len(k_rows) + 1, cols=2)
    apply_table_style(t4, [Cm(10.0), Cm(6.0)])
    set_cell_run_text(t4.cell(0, 0), "GÖSTERGE", bold=True, font_size=9)
    set_cell_run_text(t4.cell(0, 1), "DEĞER", bold=True, font_size=9, align=WD_ALIGN_PARAGRAPH.CENTER)
    for idx, (kk, klbl) in enumerate(k_rows):
        set_cell_run_text(t4.cell(idx + 1, 0), klbl, font_size=8.5)
        set_cell_run_text(t4.cell(idx + 1, 1), str(kulup_data.get(kk, "")), font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_note("(1) Kulüplerin faal oldukları branşlar belirtilecektir. Ek 3")

    # 5- GENÇLİK HİZMET VE FAALİYETLERİ
    add_section_header("5- GENÇLİK HİZMET VE FAALİYETLERİ:")
    genclik_rows = [
        ("merkezSayisi", "Gençlik Merkezi Sayısı"),
        ("kayitliUye", "Kayıtlı Üye Sayısı"),
        ("aktifUye", "Aktif Üye Sayısı"),
        ("ulusalFaaliyet", "Ulusal Faaliyetlere Katılan Üye Sayısı"),
        ("uluslararasiFaaliyet", "Uluslararası Faal. Katılan Üye Sayısı"),
        ("kampGonderilen", "Gençlik Kamplarına Gönderilenlerin Sayısı"),
        ("liderSayisi", "Lider sayısı"),
        ("noktaSayisi", "Nokta sayısı")
    ]
    for c_row in tables_data.get("customGenclikRows", []):
        genclik_rows.append((c_row, c_row))
    t5 = doc.add_table(rows=len(genclik_rows) + 1, cols=len(years) + 1)
    t5_widths = [Cm(5.5)] + [Cm((16.0 - 5.5) / max(1, len(years)))] * len(years)
    apply_table_style(t5, t5_widths)
    set_cell_run_text(t5.cell(0, 0), "FAALİYET TÜRÜ", bold=True, font_size=9, align=WD_ALIGN_PARAGRAPH.CENTER)
    for i, yr in enumerate(years):
        set_cell_run_text(t5.cell(0, i + 1), yr, bold=True, font_size=9, align=WD_ALIGN_PARAGRAPH.CENTER)
    genclik_data = tables_data.get("genclikHizmetleri", {})
    for r_idx, (gk, glbl) in enumerate(genclik_rows):
        set_cell_run_text(t5.cell(r_idx + 1, 0), glbl, font_size=8.5)
        row_vals = genclik_data.get(gk, {})
        for c_idx, yr in enumerate(years):
            set_cell_run_text(t5.cell(r_idx + 1, c_idx + 1), str(row_vals.get(yr, "")), font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)

    # 6- PERSONEL DURUMU (Denetim Dönemi + Mevcut Teftiş Yılı: endYear + 1)
    # Norm Kadro ile mevcut durumu kıyaslamak için dönem 2021-2025 ise 2026, 2022-2026 ise 2027 eklenir.
    add_section_header("6- PERSONEL DURUMU:")
    personel_data = tables_data.get("personelDurumu", {})

    personel_years = list(years)
    if years:
        next_yr_str = str(int(years[-1]) + 1)
        if next_yr_str not in personel_years:
            personel_years.append(next_yr_str)

    def render_breakdown_table(title_text, rows_spec, p_dict, custom_rows=None):
        if title_text:
            p_sub = doc.add_paragraph()
            p_sub.paragraph_format.space_before = Pt(8)
            p_sub.paragraph_format.space_after = Pt(3)
            r_sub = p_sub.add_run(title_text)
            r_sub.bold = True
            r_sub.font.size = Pt(9.5)

        all_rows = list(rows_spec)
        if custom_rows:
            for cr in custom_rows:
                all_rows.append((cr, cr))

        total_cols = len(personel_years) + 2  # Unvan + personel_years + Norm Kadro
        total_rows = 1 + len(all_rows)

        tbl = doc.add_table(rows=total_rows, cols=total_cols)
        p_widths = [Cm(4.8)] + [Cm((16.0 - 4.8 - 2.0) / max(1, len(personel_years)))] * len(personel_years) + [Cm(2.0)]
        apply_table_style(tbl, p_widths)

        # En Üst Satır (Row 0): Unvan | 2021 | 2022 | ... | 2026 | Norm Kadro
        set_cell_run_text(tbl.cell(0, 0), "Unvan", bold=True, font_size=8.5)
        for i, yr in enumerate(personel_years):
            set_cell_run_text(tbl.cell(0, i + 1), yr, bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_run_text(tbl.cell(0, total_cols - 1), "Norm Kadro", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)

        # Veri Satırları (Row 1..N)
        for r_idx, (rk, rlbl) in enumerate(all_rows):
            curr_row = r_idx + 1
            is_bold = "(1)" in rlbl or "Toplam" in rlbl
            set_cell_run_text(tbl.cell(curr_row, 0), rlbl, bold=is_bold, font_size=8)
            row_data = p_dict.get(rk, {}) if isinstance(p_dict, dict) else {}
            for c_idx, yr in enumerate(personel_years):
                val = str(row_data.get(yr, ""))
                set_cell_run_text(tbl.cell(curr_row, c_idx + 1), val, bold=is_bold, font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)
            norm_val = str(row_data.get("normKadro", ""))
            set_cell_run_text(tbl.cell(curr_row, total_cols - 1), norm_val, bold=is_bold, font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)

    # a-) İl Müdürlüğü İdari Personel Açısından Bakıldığında;
    pers_idari_rows = [
        ("ilMudur", "İl Müdürü"),
        ("hizmetMudur", "Hizmet Müdürü"),
        ("subeMudur", "Şube Müdürü"),
        ("sef", "Şef"),
        ("muhendis", "Mühendis"),
        ("arastirmaci", "Araştırmacı"),
        ("memur", "Memur"),
        ("sozlesmeliToplam", "(1) Sözleşmeli Personel sayısı"),
        ("sozlesmeliAntrenor", "• Sözleşmeli Antrenör"),
        ("sozlesmeliUzman", "• Sözleşmeli Spor Eğitim Uzmanı"),
        ("sozlesmeli4C", "• Sözleşmeli İdari Destek Personeli 4/C"),
        ("sozlesmeliYurt", "• Sözleşmeli Yurt Yönetim Personeli"),
        ("surekliIsci", "Sürekli İşçi Kadrosuna geçenlerin sayısı"),
        ("yardimciHizmet", "Yardımcı hizmet personeli sayısı")
    ]
    idari_dict = personel_data.get("idariPersonel") or personel_data.get("birlesmeSonrasi") or {}
    custom_idari = tables_data.get("customPersonelRows", [])
    render_breakdown_table("a-) İl Müdürlüğü İdari Personel Açısından Bakıldığında;", pers_idari_rows, idari_dict, custom_idari)

    # b-) İlçe Müdürlüğü Personeli Açısından Bakıldığında;
    pers_ilce_rows = [
        ("ilceMudur", "İlçe Müdürü"),
        ("temizlik", "Temizlik Personeli"),
        ("guvenlik", "Güvenlik Personeli"),
        ("teknik", "Teknik Personel")
    ]
    ilce_list = personel_data.get("ilcePersonelList") or [{"name": "", "rows": {}}]
    for idx, ilce_item in enumerate(ilce_list):
        ilce_name = (ilce_item.get("name") or "").strip()
        unit_label = f" ({ilce_name} İlçe Müdürlüğü)" if ilce_name else " (... İlçe Müdürlüğü)"
        subtitle = f"b-) İlçe Müdürlüğü Personeli Açısından Bakıldığında{unit_label};" if len(ilce_list) > 1 or idx == 0 else f"{unit_label};"
        render_breakdown_table(subtitle, pers_ilce_rows, ilce_item.get("rows", {}), ilce_item.get("customRows", []))

    # c-) Yurt Müdürlükleri Personeli Açısından Bakıldığında;
    pers_yurt_rows = [
        ("yurtMudur", "Yurt Müdürü"),
        ("yurtMudurYrd", "Yurt Müdür Yrd."),
        ("yurtYonetimMemuru", "Yurt Yönetim Memuru"),
        ("yurtYonetimPersoneli", "Yurt Yönetim Personeli"),
        ("temizlik", "Temizlik Personeli"),
        ("guvenlik", "Güvenlik Personeli"),
        ("teknik", "Teknik Personel")
    ]
    yurt_list = personel_data.get("yurtPersonelList") or [{"name": "", "kapasite": "", "rows": {}}]
    for idx, yurt_item in enumerate(yurt_list):
        yurt_name = (yurt_item.get("name") or "").strip()
        cap = (yurt_item.get("kapasite") or "").strip()
        info_parts = []
        if yurt_name:
            info_parts.append(f"{yurt_name} Yurt Müdürlüğü")
        else:
            info_parts.append("... Yurt Müdürlüğü")
        if cap:
            info_parts.append(f"Kapasite: {cap}")
        unit_label = f" ({' - '.join(info_parts)})"
        subtitle = f"c-) Yurt Müdürlükleri Personeli Açısından Bakıldığında{unit_label};" if len(yurt_list) > 1 or idx == 0 else f"{unit_label};"
        render_breakdown_table(subtitle, pers_yurt_rows, yurt_item.get("rows", {}), yurt_item.get("customRows", []))

    # d-) Gençlik Merkezi Müdürlüğü Personeli Açısından Bakıldığında;
    pers_gm_rows = [
        ("gmMudur", "Gençlik Merkezi Müdürü"),
        ("lider", "Lider"),
        ("nokta", "Nokta"),
        ("temizlik", "Temizlik Personeli"),
        ("guvenlik", "Güvenlik Personeli"),
        ("teknik", "Teknik Personel")
    ]
    gm_list = personel_data.get("genclikMerkeziList") or [{"name": "", "rows": {}}]
    for idx, gm_item in enumerate(gm_list):
        gm_name = (gm_item.get("name") or "").strip()
        unit_label = f" ({gm_name} Gençlik Merkezi Müdürlüğü)" if gm_name else " (... Gençlik Merkezi Müdürlüğü)"
        subtitle = f"d-) Gençlik Merkezi Müdürlüğü Personeli Açısından Bakıldığında{unit_label};" if len(gm_list) > 1 or idx == 0 else f"{unit_label};"
        render_breakdown_table(subtitle, pers_gm_rows, gm_item.get("rows", {}), gm_item.get("customRows", []))

    # 7- GİDERLER
    add_section_header("7- GİDERLER:")
    base_gider = [
        ("sporFaaliyet", "Spor Faaliyet Giderleri"), ("yatirim", "Yatırım Giderleri"),
        ("bakimOnarim", "Bakım Onarım"), ("personel", "Personel Giderleri"),
        ("genclikHizmet", "Gençlik Hizmetleri Giderleri"), ("yurtHizmet", "Yurt Hizmetleri Giderleri"),
        ("hizmetYonetim", "Hizmet Yönetim Giderleri"), ("sosyalTransfer", "Sosyal Transferler"),
        ("hizmetAlimi", "Hizmet Alımı")
    ]
    for c_row in tables_data.get("customGiderRows", []):
        base_gider.append((c_row, c_row))
    base_gider.append(("toplam", "TOPLAM"))
    gider_rows = base_gider
    gider_data = tables_data.get("giderler", {})

    def render_gider_table(sub_title, g_years, g_dict_key):
        if sub_title:
            p_sub = doc.add_paragraph()
            p_sub.paragraph_format.space_before = Pt(6)
            p_sub.paragraph_format.space_after = Pt(2)
            r_sub = p_sub.add_run(sub_title)
            r_sub.bold = True
            r_sub.font.size = Pt(9.5)

        tbl = doc.add_table(rows=len(gider_rows) + 1, cols=len(g_years) + 1)
        g_widths = [Cm(5.5)] + [Cm((16.0 - 5.5) / max(1, len(g_years)))] * len(g_years)
        apply_table_style(tbl, g_widths)
        set_cell_run_text(tbl.cell(0, 0), "GİDER KALEMİ", bold=True, font_size=8.5)
        for i, yr in enumerate(g_years):
            set_cell_run_text(tbl.cell(0, i + 1), yr, bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)

        cur_dict = gider_data.get(g_dict_key, {})
        for r_idx, (gk, glbl) in enumerate(gider_rows):
            is_tot = (gk == "toplam")
            set_cell_run_text(tbl.cell(r_idx + 1, 0), glbl, bold=is_tot, font_size=8)
            row_vals = cur_dict.get(gk, {})
            for c_idx, yr in enumerate(g_years):
                set_cell_run_text(tbl.cell(r_idx + 1, c_idx + 1), str(row_vals.get(yr, "")), bold=is_tot, font_size=8, align=WD_ALIGN_PARAGRAPH.RIGHT)

    if is_split:
        render_gider_table("A) Birleşme Öncesi Dönem:", pre_years, "birlesmeOncesi")
        render_gider_table("B) Birleşme Sonrası Dönem:", post_years, "birlesmeSonrasi")
    else:
        # Tek dönem (Örn: 2020-2025) - Birleşme ibaresi yok, tek tablo
        render_gider_table(None, years, "birlesmeSonrasi")

    # 8- GELİRLER
    add_section_header("8- GELİRLER:")
    base_gelir = [
        ("gsgm", "GSGM Yardımı"), ("ozelIdare", "İl Özel İdaresinden Alınan Nakit Yardımlar"),
        ("ozelGelir", "Özel Gelirler")
    ]
    for c_row in tables_data.get("customGelirRows", []):
        base_gelir.append((c_row, c_row))
    base_gelir.append(("toplam", "Toplam"))
    gelir_rows = base_gelir
    t8 = doc.add_table(rows=len(gelir_rows) + 1, cols=len(years) + 1)
    t8_widths = [Cm(5.5)] + [Cm((16.0 - 5.5) / max(1, len(years)))] * len(years)
    apply_table_style(t8, t8_widths)
    set_cell_run_text(t8.cell(0, 0), "GELİR KALEMİ", bold=True, font_size=8.5)
    for i, yr in enumerate(years):
        set_cell_run_text(t8.cell(0, i + 1), yr, bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    gelir_data = tables_data.get("gelirler", {})
    for r_idx, (gk, glbl) in enumerate(gelir_rows):
        is_tot = (gk == "toplam")
        set_cell_run_text(t8.cell(r_idx + 1, 0), glbl, bold=is_tot, font_size=8)
        row_vals = gelir_data.get(gk, {})
        for c_idx, yr in enumerate(years):
            set_cell_run_text(t8.cell(r_idx + 1, c_idx + 1), str(row_vals.get(yr, "")), bold=is_tot, font_size=8, align=WD_ALIGN_PARAGRAPH.RIGHT)

    # 9- TESİSLER
    add_section_header("9- TESİSLER (SPOR TESİSLERİ - YURT - MÜLKİYET DURUMU):")
    tesis_data = tables_data.get("tesisler", {})
    default_facilities = [
        "YURT", "DOĞAL ÇİM YÜZEYLİ STAD", "STADYUM", "TOPRAK YÜZEYLİ STAD", "SEMT SAHASI",
        "SENTETİK ÇİM YÜZEYLİ SAHA", "SPOR SALONU", "YÜZME HAVUZU", "KAMP EĞİTİM MERKEZİ",
        "ATLETİZM PİSTİ", "GENÇLİK MERKEZİ", "BUZ PİSTİ", "ATIŞ POLİGONU", "BİNİCİLİK TESİSLERİ",
        "TENİS TESİSLERİ", "GOLF SAHASI", "LOKAL BİNALARI", "BOWLİNG SALONU", "BİLARDO SALONU",
        "HOBİ KARTİNG", "DİĞER"
    ]
    tesis_turleri = tables_data.get("customFacilities") or default_facilities
    mulkiyet_list = {item.get("type"): item for item in tesis_data.get("mulkiyetList", []) if isinstance(item, dict)}

    t9_a = doc.add_table(rows=len(tesis_turleri) + 2, cols=3)
    apply_table_style(t9_a, [Cm(8.0), Cm(4.0), Cm(4.0)])
    set_cell_run_text(t9_a.cell(0, 0), "TESİS TÜRÜ", bold=True, font_size=8.5)
    set_cell_run_text(t9_a.cell(0, 1), "ADET", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_run_text(t9_a.cell(0, 2), "KAPASİTE", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)

    tot_adet, tot_kap = 0, 0
    for r_idx, tt in enumerate(tesis_turleri):
        item = mulkiyet_list.get(tt, {})
        ad_v = str(item.get("adet", ""))
        kp_v = str(item.get("kapasite", ""))
        if ad_v.isdigit(): tot_adet += int(ad_v)
        if kp_v.isdigit(): tot_kap += int(kp_v)
        set_cell_run_text(t9_a.cell(r_idx + 1, 0), tt, font_size=8)
        set_cell_run_text(t9_a.cell(r_idx + 1, 1), ad_v, font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_run_text(t9_a.cell(r_idx + 1, 2), kp_v, font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)
    
    last_r_t9 = len(tesis_turleri) + 1
    set_cell_run_text(t9_a.cell(last_r_t9, 0), "TOPLAM", bold=True, font_size=8.5)
    set_cell_run_text(t9_a.cell(last_r_t9, 1), str(tot_adet) if tot_adet else "", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_run_text(t9_a.cell(last_r_t9, 2), str(tot_kap) if tot_kap else "", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)

    # 9-b Yıllara Göre Tesis Dağılımı
    p_9b = doc.add_paragraph()
    p_9b.paragraph_format.space_before = Pt(8)
    p_9b.paragraph_format.space_after = Pt(2)
    p_9b.add_run("Tesislerin Yıllara Göre Dağılımı:").bold = True
    
    tesis_yil_rows = [
        ("sporSalonu", "Spor salonu"), ("yurt", "Yurt"), ("yuzmeHavuzu", "Yüzme havuzu"),
        ("bagimsizAtletizm", "Bağımsız Atletizm sahası"), ("stadyum", "Stadyum"),
        ("futbolSahasi", "Futbol sahası"), ("kayak", "Kayak tesisi"), ("poligon", "Poligon"),
        ("kampEgitim", "Kamp Eğitim Merkezi"), ("sporcuEgitim", "Sporcu Eğitim Merkezi (1)"),
        ("digerKurum", "Diğer kurumların tesisleri (2)"), ("diger", "Diğer tesisler (3)")
    ]
    t9_b = doc.add_table(rows=len(tesis_yil_rows) + 1, cols=len(years) + 1)
    t9b_widths = [Cm(5.5)] + [Cm((16.0 - 5.5) / max(1, len(years)))] * len(years)
    apply_table_style(t9_b, t9b_widths)
    set_cell_run_text(t9_b.cell(0, 0), "TESİS", bold=True, font_size=8.5)
    for i, yr in enumerate(years):
        set_cell_run_text(t9_b.cell(0, i + 1), yr, bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    yillara_gore = tesis_data.get("yillaraGore", {})
    for r_idx, (tk, tlbl) in enumerate(tesis_yil_rows):
        set_cell_run_text(t9_b.cell(r_idx + 1, 0), tlbl, font_size=8)
        row_vals = yillara_gore.get(tk, {})
        for c_idx, yr in enumerate(years):
            set_cell_run_text(t9_b.cell(r_idx + 1, c_idx + 1), str(row_vals.get(yr, "")), font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_note("(1) Branş açıklanacak. (2) Kurum adı ve tesisin nevi belirtilecek. (3) Hangi spor tesisi olduğu belirtilecek.")

    # 10- İL ÖZEL İDARESİ & NAKİT DURUMU
    add_section_header("10- İL ÖZEL İDARESİ KAYNAKLARINDAN YARARLANMA VE NAKİT DURUMU:")
    nakit_data = tables_data.get("nakitDurumu", {})
    t10_nakit = doc.add_table(rows=2, cols=2)
    apply_table_style(t10_nakit, [Cm(10.0), Cm(6.0)])
    nakit_tarih = nakit_data.get("nakitTarihi") or "..../..../........"
    set_cell_run_text(t10_nakit.cell(0, 0), f"Nakit Durumu ({nakit_tarih} tarihi itibariyle)", bold=True, font_size=8.5)
    set_cell_run_text(t10_nakit.cell(0, 1), "TUTAR / AÇIKLAMA", bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_run_text(t10_nakit.cell(1, 0), "Banka / Kasa Mevcutları Toplamı", font_size=8.5)
    set_cell_run_text(t10_nakit.cell(1, 1), str(nakit_data.get("nakitTutari", "")), font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)

    p_10b = doc.add_paragraph()
    p_10b.paragraph_format.space_before = Pt(6)
    p_10b.paragraph_format.space_after = Pt(2)
    p_10b.add_run("İl Özel İdaresinden Yapılan Yatırımlar:").bold = True
    
    custom_ozel = tables_data.get("customOzelIdareRows", [])
    ozel_rows = [("ozelIdareYatirim", "İl Özel İdaresinden yapılan yatırımlar (1)")]
    for c_row in custom_ozel:
        ozel_rows.append((c_row, c_row))
    t10_ozel = doc.add_table(rows=len(ozel_rows) + 1, cols=len(years) + 1)
    t10_widths = [Cm(5.5)] + [Cm((16.0 - 5.5) / max(1, len(years)))] * len(years)
    apply_table_style(t10_ozel, t10_widths)
    set_cell_run_text(t10_ozel.cell(0, 0), "KAYNAK TÜRÜ", bold=True, font_size=8.5)
    for i, yr in enumerate(years):
        set_cell_run_text(t10_ozel.cell(0, i + 1), yr, bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    for r_idx, (ok, olbl) in enumerate(ozel_rows):
        set_cell_run_text(t10_ozel.cell(r_idx + 1, 0), olbl, font_size=8)
        row_vals = nakit_data.get(ok, {})
        for c_idx, yr in enumerate(years):
            set_cell_run_text(t10_ozel.cell(r_idx + 1, c_idx + 1), str(row_vals.get(yr, "")), font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_note("(1) İ.Ö.İ. den yapılan yatırımlar açıklanacaktır.")

    # 11- SPONSORLUK
    add_section_header("11- SPONSORLUK:")
    sponsor_data = tables_data.get("sponsorluk", {})
    t11 = doc.add_table(rows=2, cols=len(years) + 1)
    t11_widths = [Cm(5.5)] + [Cm((16.0 - 5.5) / max(1, len(years)))] * len(years)
    apply_table_style(t11, t11_widths)
    set_cell_run_text(t11.cell(0, 0), "SPONSORLUK GELİRİ", bold=True, font_size=8.5)
    for i, yr in enumerate(years):
        set_cell_run_text(t11.cell(0, i + 1), yr, bold=True, font_size=8.5, align=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_run_text(t11.cell(1, 0), "Sponsorlardan Elde Edilen Kaynaklar (1)", font_size=8)
    spons_yats = sponsor_data.get("yillikKaynak", {})
    for c_idx, yr in enumerate(years):
        set_cell_run_text(t11.cell(1, c_idx + 1), str(spons_yats.get(yr, "")), font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)
    add_note("(1) Kimden ve ne sağlandığı belirtilecektir.")

    # 12-15 AÇIKLAMA VE FİZİKSEL DOSYA BELGELERİ
    add_section_header("AŞAĞIDA BELİRTİLEN KONULARDA GEREKLİ AÇIKLAMALARI YAPINIZ VE BELGELERİ EKLEYİNİZ:")
    aciklamalar = tables_data.get("aciklamalar", {})
    maddeler = [
        ("m12", "12- İl Antrenör Koordinasyon ve Değerlendirme Kurulu oluşturulup oluşturulmadığı, oluşturuldu ise Kurulun raporları. (Dosyada Fiziksel)", aciklamalar.get("m12_kurulRaporu", "")),
        ("m13", "13- Varsa fahri olarak görevlendirilen antrenörlerin belgeleri. (Antrenörlük belgesi, mezuniyet belgesi vb.) (Dosyada Fiziksel)", aciklamalar.get("m13_fahriBelgeleri", "")),
        ("m14", "14- İl Spor Merkezi Kayıtları ile branş itibariyle ücret tespitine ilişkin onay.", aciklamalar.get("m14_ucretOnayi", "")),
        ("m15", "15- Belirtilen denetim yıllarında kız-erkek branşlarında Spor Merkezi çalışmalarına katılanların listesi.", aciklamalar.get("m15_sporMerkeziListesi", ""))
    ]
    for mid, mtitle, mtext in maddeler:
        p_m = doc.add_paragraph()
        p_m.paragraph_format.space_before = Pt(6)
        p_m.paragraph_format.space_after = Pt(2)
        r_m = p_m.add_run(mtitle)
        r_m.bold = True
        r_m.font.size = Pt(9.5)
        
        p_desc = doc.add_paragraph()
        p_desc.paragraph_format.left_indent = Inches(0.2)
        p_desc.paragraph_format.space_after = Pt(6)
        r_desc = p_desc.add_run(f"Cevap / Açıklama: {mtext if mtext else '....................................................................................................'}")
        r_desc.font.size = Pt(9)

    # 16- SPOR DALI TEMSİLCİLERİ TABLOSU
    add_section_header(f"16- SPOR DALI TEMSİLCİLERİ VE FAALİYET PROGRAMLARI DURUMU ({years[-1]} / MEVCUT YIL):")
    p_not16 = doc.add_paragraph()
    p_not16.paragraph_format.space_after = Pt(4)
    r_not16 = p_not16.add_run("Spor Dalı Temsilcilerinin yönetmeliğe uygun atanıp atanmadığı, mevcutta il temsilcisi bulunup bulunmadığı ve yıllık faaliyet programlarının federasyonlarca tasdik durumu:")
    r_not16.font.size = Pt(8.5)
    r_not16.font.italic = True

    t16 = doc.add_table(rows=len(ant_branches) + 1, cols=7)
    t16_widths = [Cm(1.0), Cm(3.0), Cm(2.2), Cm(3.0), Cm(2.5), Cm(2.3), Cm(2.0)]
    apply_table_style(t16, t16_widths)
    headers16 = [
        ("NO", 0.4), 
        ("SPOR BRANŞI", 1.4), 
        ("TEMSİLCİ VAR MI?", 0.9), 
        ("TEMSİLCİ ADI SOYADI", 1.4), 
        ("ATAMA ONAY TARİH / SAYISI", 1.3), 
        ("FAALİYET PROG. TASDİK", 1.1), 
        ("AÇIKLAMA", 1.2)
    ]
    for i, (h, w) in enumerate(headers16):
        c = t16.cell(0, i)
        set_cell_run_text(c, h, bold=True, font_size=8, align=WD_ALIGN_PARAGRAPH.CENTER)
        c.width = Inches(w)

    spor_temsilci_data = tables_data.get("sporDaliTemsilcileri", {})
    for r_idx, br in enumerate(ant_branches):
        b_info = spor_temsilci_data.get(br, {})
        c0 = t16.cell(r_idx + 1, 0)
        c1 = t16.cell(r_idx + 1, 1)
        c2 = t16.cell(r_idx + 1, 2)
        c3 = t16.cell(r_idx + 1, 3)
        c4 = t16.cell(r_idx + 1, 4)
        c5 = t16.cell(r_idx + 1, 5)
        c6 = t16.cell(r_idx + 1, 6)

        set_cell_run_text(c0, str(r_idx + 1), font_size=7.5, align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_run_text(c1, br, font_size=7.5, bold=True)
        
        var_mi = str(b_info.get("varMi", ""))
        if var_mi in ["var", "Var", "evet", "Evet"]:
            var_mi_str = "VAR"
        elif var_mi in ["yok", "Yok", "hayir", "Hayır"]:
            var_mi_str = "YOK"
        else:
            var_mi_str = var_mi
        set_cell_run_text(c2, var_mi_str, font_size=7.5, align=WD_ALIGN_PARAGRAPH.CENTER)

        set_cell_run_text(c3, str(b_info.get("adSoyad", "")), font_size=7.5)
        set_cell_run_text(c4, str(b_info.get("atamaOnay", "")), font_size=7.5)

        tasdik = str(b_info.get("faaliyetTasdik", ""))
        if tasdik in ["tasdikli", "Tasdikli", "evet", "Evet"]:
            tasdik_str = "TASDİKLİ"
        elif tasdik in ["tasdiksiz", "Tasdiksiz", "hayir", "Hayır"]:
            tasdik_str = "TASDİKSİZ"
        else:
            tasdik_str = tasdik
        set_cell_run_text(c5, tasdik_str, font_size=7.5, align=WD_ALIGN_PARAGRAPH.CENTER)

        set_cell_run_text(c6, str(b_info.get("aciklama", "")), font_size=7.5)

    # Müfettiş genel değerlendirmesi
    genel_not_16 = aciklamalar.get("m16_sporDaliTemsilcileri", "")
    if genel_not_16:
        p_gn = doc.add_paragraph()
        p_gn.paragraph_format.space_before = Pt(6)
        r_gn_lbl = p_gn.add_run("Müfettiş Genel Notu / Değerlendirmesi: ")
        r_gn_lbl.bold = True
        r_gn_lbl.font.size = Pt(8.5)
        r_gn_txt = p_gn.add_run(genel_not_16)
        r_gn_txt.font.size = Pt(8.5)

    # Varsa Ek Dinamik Maddeler (17, 18 vb.)
    custom_maddeler = tables_data.get("customMaddeler", [])
    for cm in custom_maddeler:
        if not isinstance(cm, dict):
            continue
        c_num = cm.get("num", "")
        c_title = cm.get("title", "Ek Konu / Talep")
        c_desc = cm.get("desc", "")
        c_answer = cm.get("answer", "")
        
        p_cm = doc.add_paragraph()
        p_cm.paragraph_format.space_before = Pt(8)
        p_cm.paragraph_format.space_after = Pt(2)
        r_cm = p_cm.add_run(f"{c_num}- {c_title}" if c_num else c_title)
        r_cm.bold = True
        r_cm.font.size = Pt(9.5)

        if c_desc:
            p_cmd = doc.add_paragraph()
            p_cmd.paragraph_format.space_after = Pt(2)
            r_cmd = p_cmd.add_run(c_desc)
            r_cmd.font.size = Pt(8.5)
            r_cmd.font.italic = True

        p_cma = doc.add_paragraph()
        p_cma.paragraph_format.left_indent = Inches(0.2)
        p_cma.paragraph_format.space_after = Pt(6)
        r_cma = p_cma.add_run(f"Cevap / Açıklama: {c_answer if c_answer else '....................................................................................................'}")
        r_cma.font.size = Pt(9)

    doc.save(output_path)

