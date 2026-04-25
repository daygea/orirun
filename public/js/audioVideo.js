function openVideoModal(url) {
    const videoModal = document.getElementById("videoModal");
    const iframe = document.getElementById("videoFrame");

    // Create loader (same behavior)
    const loader = document.createElement("div");
    loader.id = "videoLoader";
    loader.innerHTML = `<span class="spinner"></span><span data-translate="loading">Loading...</span>`;
    loader.style = `
        text-align: center;
        font-style: italic;
        color: gray;
        padding-top: 100px;
        height: 90%;
        position: absolute;
        width: 100%;
        background: white;
        z-index: 1;
    `;

    // Reset iframe
    iframe.style.display = "none";
    iframe.src = "";
    videoModal.appendChild(loader);

    // Resolve embed URL (YouTube, Drive, Vimeo, or raw)
    const embedUrl = resolveEmbedUrl(url);

    iframe.src = embedUrl;

    // Fallback after timeout
    const fallbackTimeout = setTimeout(() => {
        if (document.getElementById("videoLoader")) {
            loader.innerHTML = `
                <p style="margin-bottom:16px;">Problems playing video</p>
                <button onclick="window.open('${url}', '_blank'); closeVideoModal();"
                    style="padding:10px 20px; font-size:16px; cursor:pointer; border: 1px solid green;" class="btn btn-md btn-default app-btn">
                    Open in new tab
                </button>
            `;
        }
    }, 20000);

    iframe.onload = () => {
        clearTimeout(fallbackTimeout);
        iframe.style.display = "block";
        const l = document.getElementById("videoLoader");
        if (l) l.remove();
    };

    videoModal.style.display = "block";
}

function closeVideoModal() {
    document.getElementById("videoFrame").src = "";
    document.getElementById("videoModal").style.display = "none";
}

/* =========================
   AUDIO (UNIVERSAL, SAFE)
   ========================= */
function openAudioModal(url) {
    const container = document.getElementById("audioPlayerContainer");

    container.innerHTML = `
        <div id="audioLoader" style="text-align:center; font-style:italic; color:gray;">
            <span class="spinner"></span>
            <span data-translate="loading"> Loading... </span>
        </div>
        <iframe id="audioIframe" allow="autoplay"
            style="display:none; width:100%; border:none;"
            height="60"></iframe>
    `;

    const iframe = document.getElementById("audioIframe");
    iframe.src = resolveEmbedUrl(url);

    const fallbackTimeout = setTimeout(() => {
        if (document.getElementById("audioLoader")) {
            container.innerHTML = `
                <p style="margin-bottom:16px;">Problems playing audio</p>
                <button onclick="window.open('${url}', '_blank'); closeAudioModal();"
                    style="padding:10px 20px; font-size:16px; cursor:pointer; border: 1px solid green;" class="btn btn-md btn-default app-btn">
                    Open in new tab
                </button>
            `;
        }
    }, 20000);

    iframe.onload = () => {
        clearTimeout(fallbackTimeout);
        document.getElementById("audioLoader")?.remove();
        iframe.style.display = "block";
    };

    document.getElementById("audioModal").style.display = "block";
}

function closeAudioModal() {
    document.getElementById("audioModal").style.display = "none";
    document.getElementById("audioPlayerContainer").innerHTML = "";
}


function resolveEmbedUrl(url) {

    // ==========================
    // YouTube (all formats)
    // ==========================
    const yt = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (yt) {
        return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
    }

    // ==========================
    // Google Drive
    // ==========================
    const drive = url.match(/\/d\/([^\/]+)/);
    if (drive) {
        return `https://drive.google.com/file/d/${drive[1]}/preview`;
    }

    // ==========================
    // Vimeo
    // ==========================
    const vimeo = url.match(/vimeo\.com\/(\d+)/);
    if (vimeo) {
        return `https://player.vimeo.com/video/${vimeo[1]}`;
    }

    // ==========================
    // TikTok
    // ==========================
    const tiktok = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
    if (tiktok) {
        return `https://www.tiktok.com/embed/${tiktok[1]}`;
    }

    // ==========================
    // Facebook video
    // ==========================
    const fb = url.match(/facebook\.com\/.*\/videos\/(\d+)/);
    if (fb) {
        return `https://www.facebook.com/video/embed?video_id=${fb[1]}`;
    }

    // ==========================
    // Instagram post/video
    // ==========================
    const insta = url.match(/instagram\.com\/p\/([\w-]+)/);
    if (insta) {
        return `https://www.instagram.com/p/${insta[1]}/embed`;
    }

    // ==========================
    // X (Twitter) video
    // ==========================
    const xTweet = url.match(/twitter\.com\/.*\/status\/(\d+)/);
    if (xTweet) {
        return `https://twitframe.com/show?url=${encodeURIComponent(url)}`;
    }

    // ==========================
    // SoundCloud audio
    // ==========================
    const sc = url.match(/soundcloud\.com\/.+/);
    if (sc) {
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true`;
    }

    // ==========================
    // Spotify track/playlist/album
    // ==========================
    const spotify = url.match(/open\.spotify\.com\/(track|playlist|album)\/([\w\d]+)/);
    if (spotify) {
        return `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}`;
    }

    // ==========================
    // Audiomack track
    // ==========================
    const am = url.match(/audiomack\.com\/([\w-]+)\/([\w-]+)/);
    if (am) {
        return `https://www.audiomack.com/embed/song/${am[1]}/${am[2]}?autoplay=1`;
    }

    // ==========================
    // Direct media files (mp4, mp3, etc.)
    // ==========================
    if (/\.(mp4|webm|ogg|mp3|wav)$/i.test(url)) {
        return url;
    }

    // ==========================
    // Default: trust provided URL
    // ==========================
    return url;
}



