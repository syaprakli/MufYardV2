from app.lib.firebase_admin import db
import re

raw_list = """Engin KOCA
engin.koca@gsb.gov.tr

Subutayhan KARAYEL
subutayhan.karayel@gsb.gov.tr

Adnan GURBET
adnan.gurbet@gsb.gov.tr

Ayfer CENGIZ ÖKER
ayfer.oker@gsb.gov.tr

Osman BAYTEKİN
osman.baytekin@gsb.gov.tr

Yaşar ŞEN
yasar.sen@gsb.gov.tr

Duysev AKSOY
duysev.aksoy@gsb.gov.tr

Erkan ALTIOK
erkan.altiok@gsb.gov.tr

Kemal BAĞ
kemal.bag@gsb.gov.tr

Dilek ÖZTÜRK
dilek.ozturk@gsb.gov.tr

Kadir Kemaloglu
kadir.kemaloglu@gsb.gov.tr

Ercan KARAOGLU
ercan.karaoglu@gsb.gov.tr

Yavuz YAMAK
yavuz.yamak@gsb.gov.tr

İsmail SERT
ismail.sert@gsb.gov.tr

Hüseyin GÜNER
Hueseyin.GUeNER@gsb.gov.tr

Kazim Mert ACIKGOZ
mert.acikgoz@gsb.gov.tr

Ayla Vural Demirkan
ayla.vuraldemirkan@gsb.gov.tr

Mahmut OGUZ
Mahmut.OGUZ@gsb.gov.tr

Mustafa BAYDAR
Mustafa.BAYDAR@gsb.gov.tr

Hayati SALLAN
Hayati.SALLAN@gsb.gov.tr

Tugrul KOLAT
Tugrul.KOLAT@gsb.gov.tr

Mehmet Nezir SAIDOGLU
nezir.saidoglu@gsb.gov.tr

Ozgur COSKUN
Ozgur.COSKUN@gsb.gov.tr

Eren SUMENGEN
Eren.SUMENGEN@gsb.gov.tr

Elif Seyda SARAC
Seyda.SARAC@gsb.gov.tr

Abdullah ERDOGAN
Abdullah.ERDOGAN@gsb.gov.tr

Tarkan TASCI
Tarkan.TASCI@gsb.gov.tr

Ali ÖZTÜRK
ali.ozturk@gsb.gov.tr

Metin YILMAZ
MetinYILMAZ@gsb.gov.tr

Aynur KENDIGELEN
Aynur.KENDIGELEN@gsb.gov.tr

Murat OZDOGAN
Murat.OZDOGAN@gsb.gov.tr

Ufuk ALTAN
Ufuk.ALTAN@gsb.gov.tr

Cavat TAS
cavat.tas@gsb.gov.tr

Murat USANMAZ
Murat.USANMAZ@gsb.gov.tr

Bilal ARSLAN
Bilal.ARSLAN@gsb.gov.tr

Salman malkoc
salmanmalkoc@gsb.gov.tr

Mehmet TUNCER
Mehmet.TUNCER@gsb.gov.tr

Ibrahim AVCI
Ibrahim.AVCI@gsb.gov.tr

Mehmet DIRI
Mehmet.DIRI@gsb.gov.tr

Sefa YAPRAKLI
Sefa.YAPRAKLI@gsb.gov.tr

Mehmet BARMAN
Mehmet.BARMAN@gsb.gov.tr

Selim VURAL
Selim.VURAL2@gsb.gov.tr

Ali MURAT
Ali.MURAT@gsb.gov.tr

Bilal AKDERE
Bilal.AKDERE@gsb.gov.tr

Murat ASLAN
Murat.ASLAN2@gsb.gov.tr

Omer DEMIRCI
Omer.DEMIRCI@gsb.gov.tr

Nihat ALTUNTAS
Nihat.ALTUNTAS@gsb.gov.tr

Kadir DOKMECI
Kadir.DOKMECI@gsb.gov.tr

Ahmet ISGOREN
Ahmet.ISGOREN@gsb.gov.tr

Elif HISAR
Elif.HISAR@gsb.gov.tr

Harun AYTEKIN
Harun.AYTEKIN@gsb.gov.tr

Mine SAHIN
Mine.SAHIN@gsb.gov.tr

Muhammet ARSLAN
Muhammet.ARSLAN@gsb.gov.tr

Muzaffer DEMIREL
Muzaffer.DEMIREL@gsb.gov.tr

Muhammed METE
Muhammed.METE@gsb.gov.tr

Bahar AYDOGDU
Bahar.AYDOGDU@gsb.gov.tr

Bahar BASER
Bahar.BASER@gsb.gov.tr

Meltem SOYSAL
Meltem.SOYSAL@gsb.gov.tr

Selin KUSAKSIZ
Selin.KUSAKSIZ@gsb.gov.tr

Nesrin ALTIPARMAK
Nesrin.ALTIPARMAK@gsb.gov.tr

Caner KARAGOZ
Caner.KARAGOZ@gsb.gov.tr

Seyfullah YUCE
Seyfullah.YUCE@gsb.gov.tr

Recep DEMIR
Recep.DEMIR2@gsb.gov.tr

Ugur KARAOGLANLAR
Ugur.KARAOGLANLAR@gsb.gov.tr

Tugce BULUT
Tugce.BULUT@gsb.gov.tr

Mahmut ALBAYRAK
Mahmut.ALBAYRAK@gsb.gov.tr

Ahmet DINC
Ahmet.DINC@gsb.gov.tr

Zekeriya YILMAZ
Zekeriya.YILMAZ@gsb.gov.tr

Eyup ARABACI
Eyup.ARABACI@gsb.gov.tr

Ethem UNAL
ethem.unal@gsb.gov.tr

Nuri GOZUKARA
Nuri.GOZUKARA@gsb.gov.tr

Savas TASKIN
Savas.TASKIN@gsb.gov.tr

Ayhan OZTURK
Ayhan.OZTURK@gsb.gov.tr

Tutku OZKOK
Tutku.OZKOK@gsb.gov.tr

Asli YURTLAK
Asli.YURTLAK@gsb.gov.tr

Dilan ONDEROGLU
Dilan.ONDEROGLU@gsb.gov.tr

Refik KUCUKYILMAZ
Refik.KUCUKYILMAZ@gsb.gov.tr

Onur TOMAS
Onur.TOMAS@gsb.gov.tr

Tugba YEGEN
Tugba.YEGEN@gsb.gov.tr

Emre MUJDECI
Emre.MUJDECI@gsb.gov.tr

Omer OZCAN
Omer.OZCAN2@gsb.gov.tr

Omurfurkan SIMSEK
Omurfurkan.SIMSEK@gsb.gov.tr

Murat YURTSEVER
Murat.YURTSEVER@gsb.gov.tr

Berk KILINC
Berk.KILINC@gsb.gov.tr

Mehmet Emin KAYA
Mehmetemin.KAYA@gsb.gov.tr

Emre AYDIN
Emre.AYDIN3@gsb.gov.tr

Şahin SALKIM
sahin.salkim@gsb.gov.tr

Gizem KAPTI
gizem.kapti@gsb.gov.tr

Muhammed Çağrı KAÇAR
muhammedcagri.kacar@gsb.gov.tr

Furkan NEŞELİ
furkan.neseli@gsb.gov.tr

Fatih ÜLBER
fatih.ulber@gsb.gov.tr

Ceyhun KÜÇÜKLER
ceyhun.kucukler@gsb.gov.tr

Ülkü YANIK
ulku.yanik@gsb.gov.tr

Leyla KARTALCİ
leyla.kartalci@gsb.gov.tr

Muhammed ALICIOĞLU
muhammed.alicioglu@gsb.gov.tr

Ahmet DEVELİ
ahmet.develi@gsb.gov.tr

Alper Şefik GÖKÇER
alpersefik.gokcer@gsb.gov.tr

Yavuz ELKOL
yavuz.elkol@gsb.gov.tr

Yeliz MOLO
yeliz.molo@gsb.gov.tr

Onur ÇELİK
onur.celik3@gsb.gov.tr

Yusuf YILMAZ
yusuf.yilmaz3@gsb.gov.tr

Tülay ÇİÇEK
tulay.cicek@gsb.gov.tr

Dündar KARATAŞ
dundar.karatas@gsb.gov.tr

Yavuz TOK
yavuz.tok@gsb.gov.tr

Hande KARGACI
hande.kargaci@gsb.gov.tr

Eda ALTINER
eda.altiner@gsb.gov.tr

Alişan SARIASLAN
alisan.sariaslan@gsb.gov.tr

fatmaserpil caylan
fatmaserpil.caylan@gsb.gov.tr

Nazlıcan DURAN
nazlican.duran@gsb.gov.tr

Merve ŞENGÜL
merve.sengul@gsb.gov.tr

Doğancan YILDIZ
dogancan.yildiz@gsb.gov.tr

Fatma BAŞKAYA
fatma.baskaya@gsb.gov.tr

Burak Yiğit ONUR
burakyigit.onur@gsb.gov.tr

Ceren ERDAL
ceren.erdal@gsb.gov.tr

Esra SUBASI
esra.subasi@gsb.gov.tr

Serife KIPER
Serife.Kiper@gsb.gov.tr

Mustafa BURAN
Mustafa.BURAN@gsb.gov.tr

Didem BOSLU
Didem.BOSLU@gsb.gov.tr

Bilgehan DOGAN
Bilgehan.DOGAN@gsb.gov.tr

Gulay TUFEKCI
Gulay.TUFEKCI@gsb.gov.tr

Mevlude CANDAN
Mevlude.CANDAN@gsb.gov.tr

Sukru PEHLIVANOGLU
Sukru.PEHLIVANOGLU@gsb.gov.tr

Sibel GUNES
Sibel.GUNES@gsb.gov.tr

Erengul GUNGOR
Erengul.GUNGOR@gsb.gov.tr

Didem METAN
Didem.METAN@gsb.gov.tr

Duygu Celik
Duygu.celik@gsb.gov.tr

Hulya DUNER
Hulya.DUNER@gsb.gov.tr

Tulun ALTINSOY
Tulun.ALTINSOY@gsb.gov.tr

Cevriye MORAL
Cevriye.MORAL@gsb.gov.tr

Yasemin DINC
Yasemin.DINC@gsb.gov.tr

Zuleyha CANAK
Zuleyha.CANAK@gsb.gov.tr

Veysi ALIMOGLU
Veysi.ALIMOGLU@gsb.gov.tr

Ahmet TUNCDOKEN
Ahmet.TUNCDOKEN@gsb.gov.tr

Hatice BULUT
Hatice.BULUT@gsb.gov.tr

Ayse SENCI
Ayse.SENCI@gsb.gov.tr

Seher SAYAR
Seher.SAYAR@gsb.gov.tr

Yeliz YAMAKLI
yeliz.yamakli@gsb.gov.tr

Özgen ATAŞ
ozgen.atas@gsb.gov.tr

Merve EROĞLU
merve.eroglu@gsb.gov.tr

Tuğçe KOCABAŞ
tugce.kocabas@gsb.gov.tr

Özlem ALAGÖZ
ozlem.alagoz@gsb.gov.tr

Hilal BOLUKBASI
Hilal.BOLUKBASI@gsb.gov.tr

Semanur NUHOĞLU
semanur.nuhoglu@gsb.gov.tr

Yasin Turan
Yasin.Turan@gsb.gov.tr"""

import re
email_map = {}
lines = [l.strip() for l in raw_list.split('\n') if l.strip()]

def normalize(n):
    return n.lower().replace(' ', '').replace('ı','i').replace('ş','s').replace('ğ','g').replace('ü','u').replace('ö','o').replace('ç','c').replace('i̇','i')

for i in range(0, len(lines)-1, 2):
    name = lines[i]
    email = lines[i+1]
    email_map[normalize(name)] = email

print(f"Loaded {len(email_map)} rules.")

contacts_ref = db.collection('contacts')
docs = contacts_ref.get()

for doc in docs:
    data = doc.to_dict()
    name = data.get('name', '')
    
    # 1. Clear everything to dash.
    match_email = "-"
    
    # 2. Re-evaluate map matching
    norm_name = normalize(name)
    for k, v in email_map.items():
        if k in norm_name or norm_name in k:
            match_email = v
            break

    doc.reference.update({'email': match_email})
    print(f"[{'MATCHED' if match_email != '-' else 'CLEARED'}] {name} -> {match_email}")
