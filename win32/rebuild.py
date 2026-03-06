import zipfile, io, json

# Lire le backup original (nw.exe pur)
data = open('painquotidienwin.exe.bak', 'rb').read()
pk_offset = data.find(b'PK\x03\x04')
if pk_offset == -1:
    # Le .bak est deja un nw.exe pur? utiliser tout le fichier
    nw_exe = data
else:
    nw_exe = data[:pk_offset]

print(f'nw.exe: {len(nw_exe)} octets')

# Nouveau package.json - fichier local au lieu d'URL distante
pkg = {
    "name": "painquotidienwin",
    "version": "3.0.0",
    "main": "index.html",
    "window": {
        "title": "Le Pain Quotidien",
        "toolbar": False,
        "frame": True,
        "width": 980,
        "height": 720,
        "min_width": 980,
        "min_height": 720
    },
    "chromium-args": "--disable-print-preview --kiosk-printing"
}

# Creer le zip
zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.writestr('package.json', json.dumps(pkg, indent=2, ensure_ascii=False))
zip_data = zip_buffer.getvalue()

# Combiner
new_exe = nw_exe + zip_data
open('painquotidienwin.exe', 'wb').write(new_exe)
print(f'Nouvel exe: {len(new_exe)} octets')

# Verifier
z = zipfile.ZipFile(io.BytesIO(zip_data))
print('Contenu:', z.namelist())
print(z.read('package.json').decode('utf-8'))
print('OK!')
