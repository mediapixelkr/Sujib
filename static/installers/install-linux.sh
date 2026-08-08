#!/bin/bash
# Sujib Firefox Extension 1-Click Installer for Linux

echo "==================================================="
echo "  Installation Automatique Extension Sujib Firefox"
echo "==================================================="
echo ""

if [ "$EUID" -eq 0 ]; then
  mkdir -p /etc/firefox/policies
  cat << 'EOF' > /etc/firefox/policies/policies.json
{
  "policies": {
    "ExtensionSettings": {
      "sujib-downloader@mediapixel.kr": {
        "installation_mode": "normal_installed",
        "install_url": "http://192.168.200.15/sujib/static/sujib-firefox-extension.xpi"
      }
    }
  }
}
EOF
  echo "[SUCCÈS] Politique globale Firefox installée dans /etc/firefox/policies/policies.json !"
else
  FF_PROF=$(ls -d ~/.mozilla/firefox/*.default* 2>/dev/null | head -n 1)
  if [ -n "$FF_PROF" ]; then
    mkdir -p "$FF_PROF/extensions"
    curl -s "http://192.168.200.15/sujib/static/sujib-firefox-extension.xpi" -o "$FF_PROF/extensions/sujib-downloader@mediapixel.kr.xpi"
    echo "[SUCCÈS] Extension copiée dans $FF_PROF/extensions/ !"
  else
    echo "[ERREUR] Profil Firefox non trouvé dans ~/.mozilla/firefox/"
  fi
fi

echo "Relancez Firefox pour utiliser l'extension Sujib."
