// app.js
// ================================================================
//  配置
// ================================================================
const DATA_URL = '/data/data.json';
const BASE_URL = '/data/';

// ================================================================
//  状态
// ================================================================
let fileList = [];
let filteredFiles = [];
let currentView = 'grid';
let currentFile = null;

// DOM 引用
const fileListEl = document.getElementById('fileList');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const fileCountEl = document.getElementById('fileCount');
const statusCount = document.getElementById('statusCount');
const statusReady = document.getElementById('statusReady');
const previewPanel = document.getElementById('previewPanel');
const previewTitle = document.getElementById('previewTitle');
const previewContent = document.getElementById('previewContent');
const previewDownload = document.getElementById('previewDownload');
const previewClose = document.getElementById('previewClose');

// ================================================================
//  缓存优化 - 预计算文件属性
// ================================================================
const fileCache = new Map();

function getCachedFileProps(name) {
    if (fileCache.has(name)) {
        return fileCache.get(name);
    }
    const ext = getFileExtension(name);
    const props = {
        icon: getFileIconFromExt(ext),
        color: getFileColorFromExt(ext),
        isText: isTextFileFromExt(ext),
        isImage: isImageFileFromExt(ext),
        isOffice: isOfficeFileFromExt(ext),
        isPDF: ext === 'pdf',
        isArchive: isArchiveFileFromExt(ext),
    };
    fileCache.set(name, props);
    return props;
}

// ================================================================
//  工具函数
// ================================================================
function formatSize(bytes) {
    if (!bytes) return '--';
    if (typeof bytes === 'string') return bytes;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

function getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : '';
}

// 优化的图标映射（直接通过扩展名获取）
const ICON_MAP = {
    pdf: 'fa-file-pdf', doc: 'fa-file-word', docx: 'fa-file-word',
    xls: 'fa-file-excel', xlsx: 'fa-file-excel',
    ppt: 'fa-file-powerpoint', pptx: 'fa-file-powerpoint',
    jpg: 'fa-file-image', jpeg: 'fa-file-image', png: 'fa-file-image',
    gif: 'fa-file-image', svg: 'fa-file-image', webp: 'fa-file-image',
    txt: 'fa-file-alt', xml: 'fa-file-code', csv: 'fa-file-csv', json: 'fa-file-code',
    zip: 'fa-file-archive', '7z': 'fa-file-archive', rar: 'fa-file-archive',
    tar: 'fa-file-archive', gz: 'fa-file-archive',
};

const COLOR_MAP = {
    pdf: '#dc2626', doc: '#2b5797', docx: '#2b5797',
    xls: '#217346', xlsx: '#217346',
    ppt: '#d24726', pptx: '#d24726',
    jpg: '#8b5cf6', jpeg: '#8b5cf6', png: '#8b5cf6',
    gif: '#8b5cf6', svg: '#8b5cf6', webp: '#8b5cf6',
    txt: '#6b7280', xml: '#6b7280', csv: '#6b7280', json: '#6b7280',
    zip: '#f59e0b', '7z': '#f59e0b', rar: '#f59e0b',
    tar: '#f59e0b', gz: '#f59e0b',
};

const TEXT_EXTS = new Set(['txt', 'xml', 'csv', 'json', 'md', 'log', 'css', 'js', 'html', 'htm']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico']);
const OFFICE_EXTS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
const ARCHIVE_EXTS = new Set(['zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz']);

function getFileIconFromExt(ext) {
    return ICON_MAP[ext] || 'fa-file';
}

function getFileColorFromExt(ext) {
    return COLOR_MAP[ext] || '#6b7280';
}

function getFileIcon(name) {
    return getFileIconFromExt(getFileExtension(name));
}

function getFileColor(name) {
    return getFileColorFromExt(getFileExtension(name));
}

function isTextFileFromExt(ext) {
    return TEXT_EXTS.has(ext);
}

function isImageFileFromExt(ext) {
    return IMAGE_EXTS.has(ext);
}

function isOfficeFileFromExt(ext) {
    return OFFICE_EXTS.has(ext);
}

function isTextFile(name) {
    return isTextFileFromExt(getFileExtension(name));
}

function isImageFile(name) {
    return isImageFileFromExt(getFileExtension(name));
}

function isOfficeFile(name) {
    return isOfficeFileFromExt(getFileExtension(name));
}

function isPDFFile(name) {
    return getFileExtension(name) === 'pdf';
}

function isArchiveFileFromExt(ext) {
    return ARCHIVE_EXTS.has(ext);
}

function isArchiveFile(name) {
    return isArchiveFileFromExt(getFileExtension(name));
}

// ================================================================
//  数据加载
// ================================================================
async function loadFileList() {
    statusReady.textContent = '加载中...';
    statusReady.style.color = '#f59e0b';
    try {
        const resp = await fetch(DATA_URL);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!Array.isArray(data)) throw new Error('data.json 格式错误，应为数组');
        fileList = data.map(item => ({
            ...item,
            size: item.size || '--',
            modified: item.modified || '--',
            name: item.name || '未命名',
        }));
        fileList.sort((a, b) => a.name.localeCompare(b.name));
        applyFilter();
        showToast(`成功加载 ${fileList.length} 个文件`, 'success');
    } catch (err) {
        console.error('加载 data.json 失败:', err);
        showToast(`加载失败: ${err.message}`, 'error');
        fileList = [];
        applyFilter();
    }
    statusReady.textContent = '就绪';
    statusReady.style.color = '#22c55e';
}

// ================================================================
//  筛选与搜索
// ================================================================
function applyFilter() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
        filteredFiles = [...fileList];
    } else {
        filteredFiles = fileList.filter(f => f.name.toLowerCase().includes(query));
    }
    render();
}

// ================================================================
//  渲染
// ================================================================
function render() {
    const items = filteredFiles;
    fileCountEl.textContent = `${items.length} 个文件`;
    statusCount.textContent = items.length;

    if (items.length === 0) {
        fileListEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>${fileList.length === 0 ? '暂无文件，请检查 data.json' : '没有匹配的文件'}</p>
                ${fileList.length === 0 ? '<span style="font-size:13px;">请确保 /data/data.json 存在且格式正确</span>' : ''}
            </div>
        `;
        return;
    }

    if (currentView === 'grid') {
        renderGrid(items);
    } else {
        renderList(items);
    }
}

function renderGrid(items) {
    const htmlItems = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const props = getCachedFileProps(item.name);
        const size = formatSize(item.size);
        const modified = item.modified || '--';
        htmlItems[i] = `
            <div class="file-item" data-name="${item.name}">
                <span class="icon" style="color:${props.color}"><i class="fas ${props.icon}"></i></span>
                <div class="name" title="${item.name}">${item.name}</div>
                <div class="meta">${size}</div>
                <div class="meta" style="font-size:10px;">${modified}</div>
            </div>
        `;
    }
    fileListEl.innerHTML = '<div class="file-grid">' + htmlItems.join('') + '</div>';
    bindItemEvents();
}

function renderList(items) {
    const htmlItems = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const props = getCachedFileProps(item.name);
        const size = formatSize(item.size);
        const modified = item.modified || '--';
        htmlItems[i] = `
            <div class="file-item" data-name="${item.name}">
                <span class="icon" style="color:${props.color}"><i class="fas ${props.icon}"></i></span>
                <span class="name" title="${item.name}">${item.name}</span>
                <span class="meta">${modified}</span>
                <span class="size">${size}</span>
            </div>
        `;
    }
    fileListEl.innerHTML = '<div class="file-list">' + htmlItems.join('') + '</div>';
    bindItemEvents();
}

function bindItemEvents() {
    document.querySelectorAll('.file-item').forEach(el => {
        el.addEventListener('click', function() {
            const name = this.dataset.name;
            const file = filteredFiles.find(f => f.name === name);
            if (file) previewFile(file);
        });
    });
}

// ================================================================
//  预览逻辑
// ================================================================
function previewFile(file) {
    currentFile = file;
    previewTitle.textContent = file.name;
    const fileUrl = BASE_URL + encodeURIComponent(file.name);

    previewContent.innerHTML = '';

    // 使用缓存的属性
    const props = getCachedFileProps(file.name);

    if (props.isArchive) {
        previewContent.innerHTML = `
            <div style="text-align:center;padding:40px;">
                <i class="fas fa-file-archive" style="font-size:64px;color:#f59e0b;display:block;margin-bottom:16px;"></i>
                <p style="color:var(--text-secondary);font-size:15px;margin-bottom:20px;">此文件为压缩包，不支持在线预览，请下载后查看。</p>
                <a href="${fileUrl}" download class="download-btn">
                    <i class="fas fa-download"></i> 下载文件
                </a>
            </div>
        `;
        previewDownload.style.display = 'none';
        previewPanel.classList.add('open');
        return;
    }

    previewDownload.style.display = 'inline-flex';
    previewDownload.onclick = () => { window.open(fileUrl, '_blank'); };

    if (props.isPDF) {
        previewContent.innerHTML = `<embed src="${fileUrl}" type="application/pdf" width="100%" height="100%" style="min-height:400px;" />`;
    } else if (props.isOffice) {
        const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(window.location.origin + fileUrl)}`;
        previewContent.innerHTML = `<iframe src="${officeUrl}" width="100%" height="100%" style="min-height:400px;border:none;"></iframe>`;
    } else if (props.isImage) {
        previewContent.innerHTML = `<img src="${fileUrl}" class="image-preview" alt="${file.name}" style="max-width:100%;max-height:80vh;object-fit:contain;" />`;
    } else if (props.isText) {
        fetch(fileUrl)
            .then(res => {
                if (!res.ok) throw new Error('获取内容失败');
                return res.text();
            })
            .then(text => {
                previewContent.innerHTML = `<div class="text-content">${escapeHtml(text)}</div>`;
            })
            .catch(err => {
                previewContent.innerHTML = `<div class="unsupported">无法读取文件内容: ${err.message}</div>`;
            });
    } else {
        previewContent.innerHTML = `
            <div style="text-align:center;padding:40px;">
                <i class="fas fa-file" style="font-size:48px;color:var(--text-secondary);opacity:0.3;display:block;margin-bottom:12px;"></i>
                <p style="color:var(--text-secondary);font-size:15px;">该格式暂不支持在线预览，请下载查看。</p>
                <a href="${fileUrl}" download class="download-btn">
                    <i class="fas fa-download"></i> 下载文件
                </a>
            </div>
        `;
        previewDownload.style.display = 'none';
    }

    previewPanel.classList.add('open');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================================================
//  关闭预览
// ================================================================
previewClose.addEventListener('click', () => {
    previewPanel.classList.remove('open');
    currentFile = null;
});

// ================================================================
//  视图切换
// ================================================================
document.getElementById('viewGrid').addEventListener('click', function() {
    currentView = 'grid';
    this.classList.add('active');
    document.getElementById('viewList').classList.remove('active');
    render();
});
document.getElementById('viewList').addEventListener('click', function() {
    currentView = 'list';
    this.classList.add('active');
    document.getElementById('viewGrid').classList.remove('active');
    render();
});

// ================================================================
//  刷新 & 搜索
// ================================================================
document.getElementById('btnRefresh').addEventListener('click', loadFileList);
document.getElementById('refreshBtn').addEventListener('click', loadFileList);

searchInput.addEventListener('input', applyFilter);
searchBtn.addEventListener('click', applyFilter);
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyFilter();
});

// ================================================================
//  Toast 通知
// ================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
    };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ================================================================
//  键盘快捷键
// ================================================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (previewPanel.classList.contains('open')) {
            previewPanel.classList.remove('open');
        }
    }
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        loadFileList();
    }
});

// ================================================================
//  初始化
// ================================================================
loadFileList();
showToast('📂 正在加载 /data/data.json ...', 'info');
console.log('💡 静态文件系统已启动，数据源:', DATA_URL);