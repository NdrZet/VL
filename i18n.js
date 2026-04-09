/**
 * Vision Lumina — Internationalization (i18n)
 * Supported languages: 'en', 'ru'
 */

window.VLi18n = (() => {

    // ── Translations ──────────────────────────────────────────────────────────

    const translations = {
        en: {
            // Header
            'header.search_placeholder': 'Search library...',
            'header.add_folder': 'Add folder',
            'header.open_file': 'Open file',

            // Sidebar
            'sidebar.section_library': 'Library',
            'sidebar.library': 'Library',
            'sidebar.recent': 'Recent',
            'sidebar.favorites': 'Favorites',
            'sidebar.playlists': 'Playlists',
            'sidebar.section_manage': 'Manage',
            'sidebar.folders': 'Folders',
            'sidebar.statistics': 'Statistics',
            'sidebar.settings': 'Settings',
            'sidebar.version': 'Vision Lumina v1.4',

            // Library view — empty state
            'library.empty_title': 'Your library is empty',
            'library.empty_desc': 'Add a folder or drop a video file here to get started',

            // Recent view
            'recent.title': 'Recently Played',
            'recent.subtitle': 'Videos you\'ve watched will appear here',
            'recent.empty_title': 'No history yet',
            'recent.empty_desc': 'Videos you open will appear here automatically',

            // Folders view
            'folders.title': 'Folders',
            'folders.subtitle': 'Manage your library sources',
            'folders.empty_title': 'No folders added',
            'folders.empty_desc': 'Add a folder to start building your library',

            // Favorites view
            'favorites.title': 'Favorites',
            'favorites.subtitle': 'Your starred videos will appear here',
            'favorites.empty': 'No favorites yet',
            'favorites.empty_hint': 'Star any video to add it here',
            'favorites.fav_btn': 'Add to Favorites',
            'favorites.unfav_btn': 'Remove from Favorites',

            // Playlists view
            'playlists.title': 'Playlists',
            'playlists.subtitle': 'Organize your videos into playlists',
            'playlists.create': 'New Playlist',
            'playlists.empty': 'No playlists yet',
            'playlists.empty_hint': 'Create your first playlist to organize videos',
            'playlists.empty_playlist': 'This playlist is empty',
            'playlists.empty_playlist_hint': 'Add videos using the button above',
            'playlists.play_all': 'Play All',
            'playlists.back': 'Back',
            'playlists.delete': 'Delete Playlist',
            'playlists.rename': 'Rename',
            'playlists.add_videos': 'Add Videos',
            'playlists.add_to': 'Add to playlist',
            'playlists.remove_video': 'Remove from playlist',
            'playlists.name_placeholder': 'Playlist name…',
            'playlists.create_confirm': 'Create',

            // Statistics view
            'stats.title': 'Statistics',
            'stats.subtitle': 'Your library insights and watch history',
            'stats.total_videos': 'Total videos',
            'stats.library_size': 'Library size',
            'stats.opened_30d': 'Opened last 30 days',
            'stats.folder_count': 'Folders in library',
            'stats.breakdown': 'Library breakdown',
            'stats.recently_watched': 'Recently watched',
            'stats.no_history': 'No watch history yet',

            // Settings view
            'settings.title': 'Settings',
            'settings.subtitle': 'Player preferences and configuration',

            'settings.group_playback': 'Playback',
            'settings.volume_label': 'Default volume',
            'settings.volume_desc': 'Volume level when opening the player',
            'settings.resume_label': 'Resume from last position',
            'settings.resume_desc': 'Automatically continue where you left off',
            'settings.autonext_label': 'Auto-play next file',
            'settings.autonext_desc': 'Play the next video in the folder when current ends',
            'settings.hwaccel_label': 'Hardware acceleration',
            'settings.hwaccel_desc': 'Use GPU for video decoding (requires restart)',

            'settings.group_library': 'Library',
            'settings.thumbnails_label': 'Generate thumbnails',
            'settings.thumbnails_desc': 'Extract preview images from video files',
            'settings.cache_label': 'Thumbnail cache',
            'settings.cache_clear': 'Clear cache',
            'settings.history_label': 'Watch history',
            'settings.history_clear': 'Clear history',

            'settings.group_appearance': 'Appearance',
            'settings.ambient_label': 'Ambient mode glow intensity',
            'settings.ambient_desc': 'Brightness of the ambient backlight effect',

            'settings.group_language': 'Language',
            'settings.language_label': 'Interface language',
            'settings.language_desc': 'Choose the display language for the app',

            'settings.group_about': 'About',
            'settings.about_version': 'Version 1.4.0',
            'settings.about_credits': 'Made by ZeFair Network',
            'settings.about_tech': 'Electron + HTML5 Video',

            // Player settings menu
            'player.stable_volume': 'Stable Volume',
            'player.ambient_mode': 'Ambient mode',
            'player.subtitles': 'Subtitles/CC',
            'player.audio_track': 'Audio track',
            'player.sleep_timer': 'Sleep timer',
            'player.playback_speed': 'Playback speed',
            'player.quality': 'Quality',

            // Player display values
            'player.value_off': 'Off',
            'player.value_on': 'On',
            'player.value_normal': 'Normal',
            'player.value_default': 'Default',
            'player.value_auto': 'Auto',
            'player.sleep_10': '10 minutes',
            'player.sleep_15': '15 minutes',
            'player.sleep_30': '30 minutes',
            'player.sleep_60': '60 minutes',
            'player.subtitles_load': 'Load file (.srt / .vtt)...',

            // Drop overlay & context menu
            'player.drop_video': 'Drop video file to play',
            'player.copy_timestamp': 'Copy timestamp',
            'player.open_in_explorer': 'Open in Explorer',

            // Dynamic strings (used by t() in JS)
            'dynamic.files': ['{n} file', '{n} files'],
            'dynamic.videos': ['{n} video', '{n} videos'],
            'dynamic.remove': 'Remove',
            'dynamic.add_folder': 'Add folder',
            'dynamic.open_file': 'Open file',
            'dynamic.thumbnails_stored': ['{n} thumbnail stored', '{n} thumbnails stored'],
            'dynamic.no_thumbnails': 'No thumbnails cached',
            'dynamic.history_items': ['{n} video in history', '{n} videos in history'],
            'dynamic.history_empty': 'History is empty',
            'dynamic.pl_videos': ['{n} video', '{n} videos'],
        },

        ru: {
            // Header
            'header.search_placeholder': 'Поиск в библиотеке...',
            'header.add_folder': 'Добавить папку',
            'header.open_file': 'Открыть файл',

            // Sidebar
            'sidebar.section_library': 'Библиотека',
            'sidebar.library': 'Библиотека',
            'sidebar.recent': 'Недавние',
            'sidebar.favorites': 'Избранное',
            'sidebar.playlists': 'Плейлисты',
            'sidebar.section_manage': 'Управление',
            'sidebar.folders': 'Папки',
            'sidebar.statistics': 'Статистика',
            'sidebar.settings': 'Настройки',
            'sidebar.version': 'Vision Lumina v1.4',

            // Library view — empty state
            'library.empty_title': 'Библиотека пуста',
            'library.empty_desc': 'Добавьте папку или перетащите видеофайл сюда',

            // Recent view
            'recent.title': 'Недавно воспроизведённые',
            'recent.subtitle': 'Здесь появятся просмотренные видео',
            'recent.empty_title': 'История пуста',
            'recent.empty_desc': 'Открытые видео будут появляться здесь автоматически',

            // Folders view
            'folders.title': 'Папки',
            'folders.subtitle': 'Управление источниками библиотеки',
            'folders.empty_title': 'Папки не добавлены',
            'folders.empty_desc': 'Добавьте папку, чтобы начать заполнять библиотеку',

            // Favorites view
            'favorites.title': 'Избранное',
            'favorites.subtitle': 'Здесь появятся видео, отмеченные звёздочкой',
            'favorites.empty': 'Нет избранного',
            'favorites.empty_hint': 'Отмечайте видео звёздочкой, чтобы добавить сюда',
            'favorites.fav_btn': 'В избранное',
            'favorites.unfav_btn': 'Убрать из избранного',

            // Playlists view
            'playlists.title': 'Плейлисты',
            'playlists.subtitle': 'Организуйте видео в плейлисты',
            'playlists.create': 'Новый плейлист',
            'playlists.empty': 'Нет плейлистов',
            'playlists.empty_hint': 'Создайте первый плейлист для организации видео',
            'playlists.empty_playlist': 'Плейлист пуст',
            'playlists.empty_playlist_hint': 'Добавьте видео с помощью кнопки выше',
            'playlists.play_all': 'Воспроизвести всё',
            'playlists.back': 'Назад',
            'playlists.delete': 'Удалить плейлист',
            'playlists.rename': 'Переименовать',
            'playlists.add_videos': 'Добавить видео',
            'playlists.add_to': 'Добавить в плейлист',
            'playlists.remove_video': 'Убрать из плейлиста',
            'playlists.name_placeholder': 'Название плейлиста…',
            'playlists.create_confirm': 'Создать',

            // Statistics view
            'stats.title': 'Статистика',
            'stats.subtitle': 'Аналитика библиотеки и история просмотров',
            'stats.total_videos': 'Всего видео',
            'stats.library_size': 'Размер библиотеки',
            'stats.opened_30d': 'Открыто за 30 дней',
            'stats.folder_count': 'Папок в библиотеке',
            'stats.breakdown': 'Разбивка по папкам',
            'stats.recently_watched': 'Недавно просмотренные',
            'stats.no_history': 'История просмотров пуста',

            // Settings view
            'settings.title': 'Настройки',
            'settings.subtitle': 'Настройки плеера',

            'settings.group_playback': 'Воспроизведение',
            'settings.volume_label': 'Громкость по умолчанию',
            'settings.volume_desc': 'Уровень громкости при открытии плеера',
            'settings.resume_label': 'Продолжить с последней позиции',
            'settings.resume_desc': 'Автоматически продолжать с места остановки',
            'settings.autonext_label': 'Автовоспроизведение следующего файла',
            'settings.autonext_desc': 'Воспроизводить следующий файл из папки по завершении',
            'settings.hwaccel_label': 'Аппаратное ускорение',
            'settings.hwaccel_desc': 'Использовать GPU для декодирования видео (требует перезапуска)',

            'settings.group_library': 'Библиотека',
            'settings.thumbnails_label': 'Генерировать миниатюры',
            'settings.thumbnails_desc': 'Извлекать превью из видеофайлов',
            'settings.cache_label': 'Кэш миниатюр',
            'settings.cache_clear': 'Очистить кэш',
            'settings.history_label': 'История просмотров',
            'settings.history_clear': 'Очистить историю',

            'settings.group_appearance': 'Внешний вид',
            'settings.ambient_label': 'Интенсивность подсветки Ambient',
            'settings.ambient_desc': 'Яркость эффекта фоновой подсветки',

            'settings.group_language': 'Язык',
            'settings.language_label': 'Язык интерфейса',
            'settings.language_desc': 'Выберите язык отображения приложения',

            'settings.group_about': 'О программе',
            'settings.about_version': 'Версия 1.4.0',
            'settings.about_credits': 'Разработано ZeFair Network',
            'settings.about_tech': 'Electron + HTML5 Video',

            // Player settings menu
            'player.stable_volume': 'Стабильная громкость',
            'player.ambient_mode': 'Режим Ambient',
            'player.subtitles': 'Субтитры',
            'player.audio_track': 'Аудиодорожка',
            'player.sleep_timer': 'Таймер сна',
            'player.playback_speed': 'Скорость воспроизведения',
            'player.quality': 'Качество',

            // Player display values
            'player.value_off': 'Выкл',
            'player.value_on': 'Вкл',
            'player.value_normal': 'Обычная',
            'player.value_default': 'По умолчанию',
            'player.value_auto': 'Авто',
            'player.sleep_10': '10 минут',
            'player.sleep_15': '15 минут',
            'player.sleep_30': '30 минут',
            'player.sleep_60': '60 минут',
            'player.subtitles_load': 'Загрузить файл (.srt / .vtt)...',

            // Drop overlay & context menu
            'player.drop_video': 'Перетащите видеофайл',
            'player.copy_timestamp': 'Копировать метку времени',
            'player.open_in_explorer': 'Открыть в Проводнике',

            // Dynamic strings
            'dynamic.files': ['{n} файл', '{n} файла', '{n} файлов'],
            'dynamic.videos': ['{n} видео', '{n} видео', '{n} видео'],
            'dynamic.remove': 'Удалить',
            'dynamic.add_folder': 'Добавить папку',
            'dynamic.open_file': 'Открыть файл',
            'dynamic.thumbnails_stored': ['{n} миниатюра сохранена', '{n} миниатюры сохранено', '{n} миниатюр сохранено'],
            'dynamic.no_thumbnails': 'Кэш миниатюр пуст',
            'dynamic.history_items': ['{n} видео в истории', '{n} видео в истории', '{n} видео в истории'],
            'dynamic.history_empty': 'История пуста',
            'dynamic.pl_videos': ['{n} видео', '{n} видео', '{n} видео'],
        }
    };

    // ── Pluralization ─────────────────────────────────────────────────────────

    function plural(n, forms) {
        if (forms.length === 2) {
            // English: [singular, plural]
            return (n === 1 ? forms[0] : forms[1]).replace('{n}', n);
        }
        // Russian: [1, 2-4, 5+]
        const mod10  = n % 10;
        const mod100 = n % 100;
        let idx;
        if (mod10 === 1 && mod100 !== 11) {
            idx = 0;
        } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
            idx = 1;
        } else {
            idx = 2;
        }
        return forms[idx].replace('{n}', n);
    }

    // ── Core API ──────────────────────────────────────────────────────────────

    let currentLang = 'en';

    /** Get stored language from localStorage (falls back to 'en') */
    function loadLang() {
        try {
            const s = JSON.parse(localStorage.getItem('vl-app-settings') || '{}');
            return s.language && translations[s.language] ? s.language : 'en';
        } catch {
            return 'en';
        }
    }

    /** Translate a key. For dynamic plural keys pass { n } as second arg. */
    function t(key, opts) {
        const dict = translations[currentLang] || translations.en;
        const val  = dict[key] ?? (translations.en[key] ?? key);
        if (Array.isArray(val)) {
            return plural(opts && opts.n !== undefined ? opts.n : 0, val);
        }
        return val;
    }

    /** Apply all data-i18n attributes to the DOM */
    function applyLang(lang) {
        if (!translations[lang]) return;
        currentLang = lang;

        // Text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const val = t(key);
            if (!Array.isArray(translations[currentLang][key])) {
                el.textContent = val;
            }
        });

        // Placeholder
        document.querySelectorAll('[data-i18n-ph]').forEach(el => {
            el.placeholder = t(el.dataset.i18nPh);
        });

        // Title attribute
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = t(el.dataset.i18nTitle);
        });
    }

    /** Initialize: load saved lang and apply */
    function init() {
        currentLang = loadLang();
        applyLang(currentLang);
    }

    return { t, applyLang, init, loadLang, get lang() { return currentLang; } };
})();
