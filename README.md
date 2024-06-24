
# Sujib - PHP YouTube Video Download Manager

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## Introduction

**Sujib** (수집, meaning "collection" in Korean) is a web-based GUI for the command-line utility `yt-dlp`. This application allows users to download YouTube videos by simply dragging and dropping URLs onto different quality profiles. The program uses a local SQLite database to eliminate the need for a separate SQL server. This script was originally created in 2018 to launch YouTube video downloads from anywhere in the world, primarily focusing on Music Videos, to store them in a collection located on a NAS in a home lab environment.

## Features

- Download YouTube videos in various quality profiles.
- Simple drag-and-drop interface for URLs.
- Uses daily updated `yt-dlp` for robust downloading capabilities.
- Built with PHP for server-side processing and jQuery for a dynamic user interface.
- Local SQLite database for storing video information and download history.

## Screenshots

![Screenshot](https://github.com/mediapixelkr/Sujib/assets/42218992/f3f1d667-c69d-4dbb-b34f-a4677ce06ac6)

## Installation

### Prerequisites

This application was created on Linux Debian and requires the following utilities:

- A web server (Nginx or Apache)
- PHP 8
- `yt-dlp`
- `mediainfo`
- `ffmpeg`
- cURL, wget or pip
- SQLite

### Steps (Linux Debian)

1. **Clone the repository into your default html folder:**
    ```sh
    cd /var/www/html
    git clone https://github.com/mediapixelkr/Sujib.git ./sujib
    cd sujib
    chown -R www-data:www-data .
    chmod -R 755 .
    chmod 777 cache
    ```

2. **Install `yt-dlp`:**
    Follow the [yt-dlp installation instructions](https://github.com/yt-dlp/yt-dlp#installation).

    You can use Aptitude (default):
    ```sh
    sudo add-apt-repository ppa:tomtomtom/yt-dlp    # Add ppa repo to apt
    sudo apt update                                 # Update package list
    sudo apt install yt-dlp                         # Install yt-dlp
    ```

    or Curl :
    ```sh
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/.local/bin/yt-dlp
    chmod a+rx ~/.local/bin/yt-dlp  # Make executable
    ```

    or wget :
    ```sh
    wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O ~/.local/bin/yt-dlp
    chmod a+rx ~/.local/bin/yt-dlp  # Make executable
    ```

    or pip :
    ```sh
    python3 -m pip install -U "yt-dlp[default]"
    ```

3. **Install `mediainfo` and `ffmpeg`:**
    ```sh
    sudo apt update
    sudo apt install mediainfo ffmpeg
    ```

4. **Ensure you have PHP 8.x, cURL, and SQLite installed:**
    A docker with PHP8 and a web server with SQLite3 will work fine too.
    ```sh
    php -v
    sudo apt install php8.2 php8.2-curl php8.2-sqlite3
    ```

5. **Install and configure your web server (if you don't already have one):**

    **For Apache:**
    ```sh
    sudo apt install apache2 libapache2-mod-php8.2
    ```

    **For Nginx:**
    ```sh
    sudo apt install nginx php8.2-fpm
    ```

6. **Restart your web server:**
    ```sh
    sudo systemctl restart apache2
    # or for nginx
    sudo systemctl restart nginx
    ```

7. **Protect the access (recommended):**
   Generate a password file
    ```sh
    sudo apt update
    sudo apt install apache2-utils
    htpasswd -c /etc/apache2/.htpasswd $USER
    ```

    **For Apache:**
   (adapt USER name)
    ```sh
    echo 'AuthType Basic
    AuthName "Restricted Content"
    AuthUserFile /home/USER/.htpasswd
    Require valid-user' | sudo tee /var/www/html/Sujib/.htaccess
    ```

    **For Nginx:**
    ```sh
    sudo nano /etc/nginx/sites-enabled/default
    ```
    Then add after "server_name _;" (adapt USER name):
    ```sh
    location /youtube/ {
        try_files $uri $uri/ =404;
        auth_basic "restricted access";
        auth_basic_user_file /home/USER/.htpasswd;
    }
    ```

8. **Access the application via your browser:**
    ```
    http://host/sujib
    ```

## Usage

1. Follow the instructions for the first setup, the database will be created.
2. Use the options menu or profiles to change the download settings.
3. **Drag and drop a YouTube video URL into the designated area or use the form. The link should not contain anything else than https://www.youtube.com/watch?v=[ID]**
4. **The video will be downloaded using `yt-dlp` and saved to your specified directory.**

## Contributing

Contributions are welcome! Please fork this repository and submit a pull request for any features, bug fixes, or enhancements.

## License

Distributed under the GNU General Public License v3.0. See `LICENSE` for more information.

## Contact

Your Name - [contact.mediapixel@gmail.com](mailto:contact.mediapixel@gmail.com)

Project Link: [https://github.com/mediapixel/Sujib](https://github.com/mediapixel/Sujib)
