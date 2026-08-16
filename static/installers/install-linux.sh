#!/bin/bash
# Sujib Firefox Extension 1-Click Installer for Linux

SUJIB_URL="${1:-http://localhost:8000}"
SUJIB_XPI_URL="${SUJIB_URL}/static/sujib-firefox-extension.xpi"

echo "==================================================="
echo "  Installation Automatique Extension Sujib Firefox"
echo "==================================================="
echo "URL Serveur : $SUJIB_URL"
echo ""

if [ "$EUID" -eq 0 ]; then
  mkdir -p /etc/firefox/policies
  cat << EOF > /etc/firefox/policies/policies.json
{
  "policies": {
    "ExtensionSettings": {
      "sujib-downloader@mediapixel.kr": {
        "installation_mode": "normal_installed",
        "install_url": "$SUJIB_XPI_URL"
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
    curl -s "$SUJIB_XPI_URL" -o "$FF_PROF/extensions/sujib-downloader@mediapixel.kr.xpi"
    echo "[SUCCÈS] Extension copiée dans $FF_PROF/extensions/ !"
  else
    echo "[ERREUR] Profil Firefox non trouvé dans ~/.mozilla/firefox/"
  fi
fi

echo "Relancez Firefox pour utiliser l'extension Sujib."
