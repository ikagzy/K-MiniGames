# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['launcher.py'],
    pathex=['src'],
    binaries=[],
    datas=[('src/k_minigames/assets/runtime', 'k_minigames/assets/runtime'), ('src/k_minigames/data', 'k_minigames/data'),
           ('src/k_minigames/assets/fonts', 'k_minigames/assets/fonts'),
           ('src/k_minigames/assets/lib', 'k_minigames/assets/lib')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='K-MiniGames',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version='build/version_kminigames.txt',
    icon=['src/k_minigames/assets/icon.ico'],
)
