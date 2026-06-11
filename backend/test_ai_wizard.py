import sys
import os
import asyncio
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.ai_service import AIService
from app.services.audit_service import AuditService

async def run_tests():
    service = AIService()
    user = {"uid": "D9aQ38CQb3U35QoRDtPMVhy4O2G2", "email": "sefa@test.com"}
    
    print("\n==================================================")
    print("RUNNING AI WIZARD & EXAMPLE POOL UNIT TESTS")
    print("==================================================")
    
    # 1. Test: Rapor Yapısı Analiz Etme
    print("\n[TEST 1] Testing analyze_report_structure...")
    sample_report_content = """
    T.C. GENÇLİK VE SPOR BAKANLIĞI
    Rehberlik ve Denetim Başkanlığı
    
    GİRİŞ
    Bakanlık Makamının 01.01.2025 tarihli onayı ile Ankara İl Müdürlüğü denetimi yapılmıştır.
    
    TESPİTLER VE BULGULAR
    1. Yurt kantininde fiyat listelerinin asılmadığı tespit edilmiştir.
    
    SONUÇ
    Gerekli uyarıların yapılması ve eksikliklerin 15 gün içinde giderilmesi arz olunur.
    """
    
    try:
        rules = await service.analyze_report_structure(
            content=sample_report_content,
            report_type="inceleme",
            user=user
        )
        print("Success! Extracted Rules Preview:")
        print(rules[:300] + "...\n")
        assert len(rules) > 50, "Extracted rules are too short."
    except Exception as e:
        print("FAIL: analyze_report_structure failed")
        print(traceback.format_exc())
        return

    # 2. Test: Örnek Rapor Kaydetme
    print("[TEST 2] Testing save_report_example...")
    example_id = None
    try:
        saved_doc = await service.save_report_example(
            title="Test Raporu Şablonu",
            report_type="inceleme",
            content=sample_report_content,
            user=user
        )
        example_id = saved_doc["id"]
        print(f"Success! Saved Example ID: {example_id}")
        assert saved_doc["title"] == "Test Raporu Şablonu"
        assert saved_doc["report_type"] == "inceleme"
        assert "extracted_rules" in saved_doc
    except Exception as e:
        print("FAIL: save_report_example failed")
        print(traceback.format_exc())
        return

    # 3. Test: Kayıtlı Raporları Listeleme
    print("\n[TEST 3] Testing get_report_examples...")
    try:
        examples = await service.get_report_examples(user=user, report_type="inceleme")
        print(f"Success! Found {len(examples)} examples.")
        assert len(examples) > 0, "No examples listed."
        # Ensure our saved one is in the list
        found = any(ex["id"] == example_id for ex in examples)
        assert found, "Saved example ID not found in the list."
    except Exception as e:
        print("FAIL: get_report_examples failed")
        print(traceback.format_exc())
        return

    # 4. Test: Sihirbaz ile Taslak Rapor Oluşturma
    print("\n[TEST 4] Testing generate_report_from_wizard...")
    try:
        # Get an existing audit ID to use for context
        audits = await AuditService.get_all_audits(user_id=user["uid"], user_email=user["email"])
        if not audits:
            print("SKIPPED: No audits found in the database to test wizard generation.")
        else:
            audit_id = audits[0]["id"]
            print(f"Using Audit ID for testing: {audit_id}")
            
            wizard_html = await service.generate_report_from_wizard(
                audit_id=audit_id,
                example_id=example_id,
                report_type="inceleme",
                selected_findings=[
                    "Yurt yemekhanesinde hijyen standartlarına uyulmadığı görüldü.",
                    "Yangın çıkış kapılarının kilitli olduğu gözlemlendi."
                ],
                instructions="Tenkitleri resmi dilde yaz, 7405 sayılı kanuna atıfta bulun.",
                user=user
            )
            print("Success! Generated Report HTML Preview:")
            print(wizard_html[:400] + "...\n")
            assert "html" in wizard_html or "<" in wizard_html, "Output is not HTML."
    except Exception as e:
        print("FAIL: generate_report_from_wizard failed")
        print(traceback.format_exc())
        return

    # 5. Test: Örnek Rapor Silme
    print("[TEST 5] Testing delete_report_example...")
    try:
        success = await service.delete_report_example(example_id=example_id, user=user)
        print(f"Success! Delete operation result: {success}")
        assert success is True
        
        # Verify it is deleted
        examples_after = await service.get_report_examples(user=user, report_type="inceleme")
        found = any(ex["id"] == example_id for ex in examples_after)
        assert not found, "Example was not deleted successfully."
    except Exception as e:
        print("FAIL: delete_report_example failed")
        print(traceback.format_exc())
        return

    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
