# Sujib (수집) — Gestionnaire de Téléchargements YouTube v2.0

[English Version / Lire en Anglais](README.md)

<div align="center">
  <img src="docs/screenshot.png" alt="Interface Sujib 2.0" width="100%" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
  <br><br>
  <p><strong>Gestionnaire de téléchargement YouTube moderne, performant et élégant propulsé par Python (FastAPI), yt-dlp et FFmpeg.</strong></p>
</div>

---

## 🌟 Points Forts & Fonctionnalités (v2.0)

- **⚡ Architecture Python Moderne** : Backend asynchrone haute performance propulsé par **FastAPI** et **uvicorn**, avec intégration directe de l'API interne `yt-dlp`.
- **🎨 Interface Sombre & Épurée (Sujib 2.0)** : Design glassmorphism soigné avec typographies modernes, micro-animations et icônes vectorielles SVG sobres.
- **🎯 Zone de Drag & Drop Intelligente** : Glissez-déposez n'importe quel lien YouTube ou playlist sur la zone de dépôt pour choisir le profil de qualité et le dossier de destination au survol.
- **📁 Dossiers Prédéfinis Personnalisés** : Configurez vos dossiers de classement par catégorie (*Albums US, MV K-Pop, EDM, Documentaires...*) et envoyez vos téléchargements directement au bon endroit.
- **🎛️ Profils de Qualité Personnalisables** : Créez et ajustez vos profils (4K, 1440p, 1080p, 720p, MP3 Audio-Only...) avec des formules de sélecteur `yt-dlp -f` sur mesure.
- **📊 Métadonnées Techniques Complètes** : Détection et affichage des codecs vidéo/audio (`H264`, `VP9`, `AV1`, `AAC`, `Opus`), du bitrate, du framerate (`60 fps`), de la résolution et de la taille du fichier via `ffprobe`.
- **✏️ Renommage Manuel & Nettoyage Regex** : Moteur de renommage automatique par expressions régulières (`motif||remplacement`) + bouton de renommage manuel direct avec mise à jour du fichier physique sur le disque.
- **🗑️ Suppression Contrôlée** : Choix interactif lors de la suppression (supprimer le fichier physique du disque dur + retirer de la liste, ou retirer de l'historique uniquement).
- **📋 Détection & Sélection de Playlists** : Modal interactif permettant de prévisualiser, sélectionner ou filtrer les vidéos d'une playlist avant de lancer le téléchargement.
- **🔄 Mise à Jour 1-Clic de yt-dlp** : Vérification et mise à jour de `yt-dlp` en arrière-plan directement depuis la barre de navigation.
- **🦊 Extension Firefox v2.0** : Module complémentaire permettant d'envoyer n'importe quelle vidéo ou sélection vers Sujib en 1 clic avec choix du profil et du dossier de destination.

---

## 🏗️ Structure du Projet

```text
sujib/
├── main.py                    # API REST FastAPI & flux d'événements SSE
├── downloader.py              # Worker de téléchargement asynchrone & moteur yt-dlp/ffprobe
├── database.py                # Schéma SQLite & gestion des téléchargements/profils
├── updater.py                 # Gestionnaire de mise à jour automatique yt-dlp
├── requirements.txt           # Dépendances Python (FastAPI, yt-dlp, uvicorn...)
├── sujib.service              # Fichier de service Systemd pour exécution en tâche de fond
├── docs/
│   └── screenshot.png         # Capture d'écran officielle v2.0
├── extension/                 # Code source de l'extension Firefox v2.0
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html / popup.js
│   ├── options.html / options.js
│   └── icons/
└── static/                    # Interface Web Single-Page (SPA)
    ├── index.html
    ├── css/style.css
    ├── js/app.js
    └── installers/            # Scripts d'installation automatisés
```

---

## 🚀 Installation & Déploiement

### 1. Prérequis Système
- **Linux** (Debian, Ubuntu, Arch, Fedora...) ou Windows / macOS
- **Python 3.10+**
- **FFmpeg** & **FFprobe** installés (`sudo apt install ffmpeg`)

### 2. Installation de l'application
```bash
# Cloner le dépôt
git clone https://github.com/mediapixelkr/Sujib.git /var/www/html/sujib
cd /var/www/html/sujib

# Créer l'environnement virtuel Python
python3 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configuration du Service Systemd (Linux)
Pour que Sujib tourne en continu en arrière-plan :

```bash
# Copier le service systemd
sudo cp sujib.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sujib.service
```

### 4. Configuration Nginx (Reverse Proxy)
Ajoutez ce bloc dans votre configuration de site Nginx (`/etc/nginx/sites-available/default`) :

```nginx
location /sujib/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
}
```

Rechargez Nginx :
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 🦊 Extension Firefox (v2.0)

L'extension Firefox vous permet de télécharger n'importe quelle vidéo ou playlist YouTube directement depuis votre navigateur.

### Installation :
1. **Via `about:debugging` (Installation locale immédiate)** :
   - Téléchargez l'archive **`static/sujib-firefox-extension.zip`** et décompressez-la.
   - Dans Firefox, ouvrez `about:debugging#/runtime/this-firefox`.
   - Cliquez sur **« Charger un module temporaire... »** et sélectionnez `manifest.json`.
2. **Configuration** :
   - Cliquez sur l'icône Sujib dans la barre d'outils Firefox $\rightarrow$ **Options**.
   - Indiquez l'URL de votre serveur (ex: `http://192.168.200.15/sujib`).
   - Vos profils et dossiers personnalisés sont automatiquement synchronisés en temps réel !

---

## ⚙️ Configuration & Personnalisation

Dans l'interface web, cliquez sur le bouton **Configuration** en haut à droite :
- **Dossiers Prédéfinis** : Ajoutez vos dossiers favoris avec libellé et chemin absolu.
- **Profils de Qualité** : Modifiez les conteneurs (MKV, MP4, WebM, MP3) et les options `yt-dlp -f`.
- **Règles de Renommage Regex** : Nettoyez automatiquement les titres pollués (ex: suppression de `[Official Video]`, normalisation des tirets et guillemets).
- **Sous-titres** : Activez l'extraction automatique des sous-titres en `.srt` externe ou incrustés.

---

## 📜 Licence

Distribué sous licence MIT. Développé avec passion pour une gestion simple, rapide et autonome de vos médias.
