$(document).ready(function() {
    var num = 0;
    var downloadQueue = [];
    var isDownloading = false;

    $.modal.defaults = {
        overlay: "#000",
        opacity: 0.75,
        zIndex: 1,
        escapeClose: false,
        clickClose: false,
        closeText: 'Close',
        showClose: false,
        modalClass: "modal",
        spinnerHtml: null,
        showSpinner: true
    };

    function animateDownload() {
        $('#queue ul li').each(function(index) {
            $(this).css('animation', 'PushDown 1s ease-out');
        });

        var loaderHtml = '<li id="temp-loader" class="loader-container-temp" style="background: rgb(205, 215, 231);"><div class="loader-temp"></div></li>';
        $('#queue ul').prepend(loaderHtml);
    }

    $(".submit-download").click(function(e) {
        e.preventDefault();

        var downloadLink = $('.input-link').val();
        var quality = $('.quality-select').val();

        if (downloadLink) {
            downloadQueue.push({ link: downloadLink, quality: quality });
            processDownloadQueue();
        }

        $('.input-link').val('');
    });

    $('.quality-select').select2({
        theme: "flat",
        minimumResultsForSearch: Infinity
    });

    function processDownloadQueue() {
        if (isDownloading || downloadQueue.length === 0) {
            return;
        }

        isDownloading = true;
        var downloadItem = downloadQueue.shift();

        animateDownload();

        download(downloadItem.link, downloadItem.quality)
            .then(() => {
                isDownloading = false;
                processDownloadQueue();
            })
            .catch((error) => {
                console.error('Download failed:', error);
                isDownloading = false;
                processDownloadQueue();
            });
    }

    function download(url, params) {
        return new Promise((resolve, reject) => {
            $.post("thumbnails.php", { url: url }, function(data, status) {
                $('#queue ul').find('.loader-container-temp').remove();

                var thisdownload = data + num;
                num++;
                var htmlContent = `
                <li id="${thisdownload}" class="${thisdownload}" style="background: rgb(240, 231, 161);"><img src="cache/${data}_default.jpg"><img src="cache/${data}_1.jpg"><img src="cache/${data}_2.jpg"><div class="text-bloc">
                  <div class="loader" id="loader${thisdownload}"></div></div>
                <div class="options opt${thisdownload}">
                  <button type="button" class="btn link" id="${thisdownload}">
                    <i class="fab fa-youtube fa-lg"></i> Launch Youtube
                  </button>
                </div>
              </li>`;
                $("#queue ul").prepend(htmlContent);
                $(".opt" + thisdownload).hide();

                $("#queue ul").find("li:first-child").each(function() {
                    $(this).click(function(e) {
                        if ($(this).hasClass("li_old_download_clicked")) {
                            $(this).removeClass("li_old_download_clicked");
                        } else {
                            $(this).addClass("li_old_download_clicked");
                        }
                        $(this).find(".options").slideToggle(50);
                    }).find(".options").click(function(e) {
                        return false;
                    });

                    $(this).find(".link").click(function(e) {
                        e.preventDefault();
                        window.open('https://www.youtube.com/watch?v=' + $(this).attr('id'));
                    });
                });

                setTimeout(function() {
                    var loaderSelector = "#loader" + thisdownload;
                    if ($(loaderSelector).length > 0) {
                        $.post("download.php", { url: url, id: params }, function(status2) {
                            status2 = jQuery.parseJSON(status2);
                            $(loaderSelector).replaceWith('<div class="text-bloc">' + status2.table + '</div>');
                            $("#queue ul").find("." + thisdownload).css({
                                background: '#CDD7E7'
                            }).attr("id", status2.id);

                            var newrenbutton = $("#queue ul").find("." + thisdownload).find(".options").append('<button type="button" class="btn rename" id="' + status2.id + '"><i class="fas fa-edit fa-sm"></i> Rename</button>');
                            var newdelbutton = $("#queue ul").find("." + thisdownload).find(".options").append('<button type="button" class="btn delete" id="' + status2.id + '"><i class="fas fa-trash-alt fa-sm"></i> Delete file</button>');

                            $(newrenbutton).find(".rename").on("click", function(e) {
                                e.preventDefault();
                                this.blur();
                                var renid = $(this).attr('id');
                                $.get('rename.php?id=' + renid, function(html) {
                                    $('#rename-form').html('');
                                    $(html.toString()).appendTo('#rename-form');
                                    $('#rename-form').modal({
                                        modalClass: "modal-rename"
                                    });
                                });
                            });

                            $(newdelbutton).find(".delete").on("click", function(e) {
                                e.preventDefault();
                                this.blur();
                                var delid = $(this).attr('id');
                                $.get('delete.php?id=' + delid, function(html) {
                                    $('#delete-form').html('');
                                    $(html.toString()).appendTo('#delete-form');
                                    $('#delete-form').modal({
                                        modalClass: "modal-delete"
                                    });
                                });
                            });

                            resolve();
                        }).fail(function() {
                            console.error("Download failed.");
                            reject();
                        });
                    } else {
                        console.error("Loader element not found for replacement");
                        reject();
                    }
                }, 500); // Delay to ensure element is inserted
            }).fail(function() {
                console.error("Thumbnail request failed.");
                reject();
            });
        });
    }

    function saveOptions() {
        var show_last = $("#show_last").val();
        var subtitles = $("#subtitles").val();
        var sub_lang = $("#sub_lang").val();

        $.post("options.php?submit", {
            showlast: show_last,
            subtitles: subtitles,
            sub_lang: sub_lang
        }, function(response) {
            if (response.status === 'success') {
                console.log('Options saved successfully!');
            } else {
                console.error('Failed to save options. Please try again.');
            }
        }).fail(function() {
            console.error('Failed to save options. Please try again.');
        });
    }

    $(document).on('modal:before-close', '#options-form', function(event, modal) {
        saveOptions();
    });

    $(document).on('click', '.btn.close', function(e) {
        e.preventDefault();
        saveOptions();
        $.modal.close();
    });

    function htmlspecialchars(str) {
        if (typeof str !== "string") {
            return str;
        }
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }

    function loadProfiles() {
        $.getJSON('profiles.php?get_profiles', function(profiles) {
            var profilesHtml = '';
            profiles.forEach(function(profile) {
                profilesHtml += `
                    <div class="profile-item" data-id="${profile.id}">
                        <input type="hidden" class="profile-input" name="id" value="${profile.id}" />
                        <label>Profile Name:</label>
                        <input type="text" class="profile-name-input" name="name" maxlength="45" value="${htmlspecialchars(profile.name ? profile.name : '')}" />
                        <label>Container:</label>
                        <select class="profile-input" name="container">
                            <option value="mkv" ${profile.container == 'mkv' ? 'selected' : ''}>MKV</option>
                            <option value="mp4" ${profile.container == 'mp4' ? 'selected' : ''}>MP4</option>
                        </select>
                        <div class="resolution-container">
                            <label>Max Res.:</label>
                            <input type="text" class="profile-res-input short-input" name="max_res" maxlength="4" value="${htmlspecialchars(profile.max_res ? profile.max_res : '')}" />
                            <label>Min Res.:</label>
                            <input type="text" class="profile-res-input short-input" name="min_res" maxlength="4" value="${htmlspecialchars(profile.min_res ? profile.min_res : '')}" />
                        </div>
                        <button type="button" class="btn delete-profile" data-id="${profile.id}" style="background-color: #d9534f; margin-left: auto;">Delete</button>
                    </div>
                `;
            });
            $('#profiles-list').html(profilesHtml);

            $('#profiles-list').sortable({
                update: function(event, ui) {
                    saveProfileOrder();
                }
            });
        }).fail(function() {
            $('#profiles-list').html('<p>Error loading profiles. Please try again.</p>');
        });
    }

    function saveProfiles(callback) {
        var profiles = [];
        $('.profile-item').each(function() {
            var id = $(this).find('input[name="id"]').val();
            var name = $(this).find('input[name="name"]').val();
            var container = $(this).find('select[name="container"]').val();
            var max_res = $(this).find('input[name="max_res"]').val();
            var min_res = $(this).find('input[name="min_res"]').val();
            
            if (!max_res && !min_res) {
                min_res = '1080'; 
            }

            if (!name) {
                name = 'Experimental';
            }

            profiles.push({
                id: id,
                name: name,
                container: container,
                max_res: max_res,
                min_res: min_res
            });
        });

        $.post('profiles.php', { update_profiles: true, profiles: profiles }, function(response) {
            if (response.status === 'success') {
                console.log('Profiles saved successfully!');
                if (callback) callback();
            } else {
                console.error('Failed to save profiles:', response.message);
                alert('Failed to save profiles. Please try again.');
            }
        }, 'json').fail(function() {
            console.error('Failed to save profiles.');
            alert('Failed to save profiles. Please try again.');
        });
    }

    function saveProfileOrder() {
        var profiles = [];
        $('.profile-item').each(function(index) {
            var id = $(this).data('id');
            profiles.push({
                id: id,
                reorder: index + 1
            });
        });

        $.post('profiles.php', { reorder_profiles: true, profiles: profiles }, function(response) {
            if (response.status === 'success') {
                console.log('Profile order saved successfully!');
            } else {
                console.error('Failed to save profile order:', response.message);
                alert('Failed to save profile order. Please try again.');
            }
        }, 'json').fail(function() {
            console.error('Failed to save profile order.');
            alert('Failed to save profile order. Please try again.');
        });
    }

    $(document).on('modal:open', '#profiles-form', function(event, modal) {
        loadProfiles();
    });

    $('#add_profile').click(function() {
        $.post('profiles.php', { add_profile: true }, function(response) {
            if (response.status === 'success') {
                loadProfiles();
            } else {
                alert('Failed to add profile. Please try again.');
            }
        }, 'json').fail(function() {
            alert('Failed to add profile. Please try again.');
        });
    });

    $('#reset_profiles').click(function() {
        if (confirm('Are you sure you want to delete the current profiles and go back to default?')) {
            $.post('profiles.php', { reset_profiles: true }, function(response) {
                if (response.status === 'success') {
                    loadProfiles();
                } else {
                    alert('Failed to reset profiles. Please try again.');
                }
            }, 'json').fail(function() {
                alert('Failed to reset profiles. Please try again.');
            });
        }
    });

    $(document).on('click', '.delete-profile', function() {
        var id = $(this).data('id');
        if (confirm('Are you sure you want to delete this profile?')) {
            $.post('profiles.php', { delete_profile: true, id: id }, function(response) {
                if (response.status === 'success') {
                    loadProfiles();
                } else {
                    alert('Failed to delete profile. Please try again.');
                }
            }, 'json').fail(function() {
                alert('Failed to delete profile. Please try again.');
            });
        }
    });

    $(document).on('modal:before-close', '#profiles-form', function(event, modal) {
        saveProfiles(function() {
            location.reload();
        });
    });

    $('.drop').each(function() {
        $(this).on('dragenter', function() {
            $(this).css('border', '2px dashed #ff5177');
            $(this).css('background', 'rgba(255,255,255,0.50)');
            return false;
        });

        $(this).on('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).css('border', '2px dashed #ff5177');
            $(this).css('background', 'rgba(255,255,255,0.50)');
            return false;
        });

        $(this).on('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).css('border', '2px dashed #3f51b5');
            $(this).css('background', '#ffffff');
            return false;
        });

        $(this).on("drop", function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(this).css('border', '2px dashed #3f51b5');
            $(this).css('background', '#ffffff');
            var Url = e.originalEvent.dataTransfer.getData('Text');

            animateDownload();

            download(Url, $(this).attr('id'));
        });
    });

    $('.tabs li').each(function() {
        $(this).find(".options").hide();
        $(this).click(function(e) {
            if ($(this).hasClass("li_old_download_clicked")) {
                $(this).removeClass("li_old_download_clicked");
            } else {
                $(this).addClass("li_old_download_clicked");
            }
            $(this).find(".options").slideToggle(50);
        }).find(".options").click(function(e) {
            return false;
        });

        $(this).find(".link").click(function(e) {
            e.preventDefault();
            window.open('https://www.youtube.com/watch?v=' + $(this).attr('id'));
        });

        $(this).find(".rename").click(function(e) {
            e.preventDefault();
            this.blur();
            var renid = $(this).attr('id');
            $.get('rename.php?id=' + renid, function(html) {
                $('#rename-form').html('');
                $(html.toString()).appendTo('#rename-form');
                $('#rename-form').modal({
                    modalClass: "modal-rename"
                });
            });
        });

        $(this).find(".delete").click(function(e) {
            e.preventDefault();
            this.blur();
            var delid = $(this).attr('id');
            $.get('delete.php?id=' + delid, function(html) {
                $('#delete-form').html('');
                $(html.toString()).appendTo('#delete-form');
                $('#delete-form').modal({
                    modalClass: "modal-delete"
                });
            });
        });

        $(this).find(".terminate").click(function(e) {
            e.preventDefault();
            this.blur();
            console.log("Terminate button clicked");

            var terminateId = $(this).attr('id');
            console.log("Terminate ID: " + terminateId);

            $.get('delete.php?terminate=true&id=' + terminateId, function(response) {
                console.log("Response received: ", response);

                var jsonResponse = JSON.parse(response);

                if (jsonResponse.status === "success") {
                    console.log("Success message found, reloading page");
                    location.reload();
                } else {
                    console.log("Handling error or other response");
                    $('#delete-form').html('');
                    $('<div>').html(jsonResponse.message).appendTo('#delete-form');
                    $('#delete-form').modal({
                        modalClass: "modal-delete"
                    });
                }
            });
        });
    });

    $(document).on("click", "div.hide a", function(e) {
        e.preventDefault();
        var hideid = $(this).attr('id');
        $.post("delete.php?id=" + hideid, { file: false }, function(status) {
            if (status == 'done') {
                $('.tabs li[id=' + hideid + ']').hide('fast', function() { $('.tabs li[id=' + hideid + ']').remove(); });
            }
        });
    });

    $('.quality-select').select2({
        theme: "flat",
        minimumResultsForSearch: Infinity
    });
});
