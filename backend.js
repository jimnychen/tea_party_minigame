const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const os = require('os');
// 確保使用 UTF-8 編碼
process.env.ENCODING = 'utf-8';

const app = express();
const PORT = 80;
function getLocalIPAddress() {
  const networkInterfaces = os.networkInterfaces();
  let ipAddress;

  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((iface) => {
      // Skip over internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        ipAddress = iface.address;
        // Optionally break here if the first suitable address is enough
      }
    });
  });

  return ipAddress || '127.0.0.1'; // Fallback to localhost if not found
}

// 中間件：解析 JSON 請求體
app.use(express.json());

// 設定 multer 上傳
const CharacterUploadDir = path.join(__dirname, 'question_bank', 'CharacterQuestionBank');
const songUploadDir = path.join(__dirname, 'question_bank', 'SongQuestionBank');

// 確保上傳目錄存在
if (!fs.existsSync(CharacterUploadDir)) fs.mkdirSync(CharacterUploadDir, { recursive: true });
if (!fs.existsSync(songUploadDir)) fs.mkdirSync(songUploadDir, { recursive: true });

// 配置 multer 儲存
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = req.query.type || 'Character';
        const uploadDir = type === 'Character' ? CharacterUploadDir : songUploadDir;
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // workaround for encoding issues
        cb(null,  Buffer.from(file.originalname, 'latin1').toString('utf-8'));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB 限制
});


// 讀取 JSON 格式的題目設定
const settingsPath = path.join(__dirname, 'QuestionConfig.json');
if (!fs.existsSync(settingsPath)) {
    // 如果設定檔不存在，建立一個預設的空設定檔
    const defaultSettings = {
        挖洞猜角色題庫: [],
        猜歌大挑戰題庫: []
    }
    fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings), 'utf-8');
}
let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
let 挖洞猜角色題庫 = settings.挖洞猜角色題庫;
let 猜歌大挑戰題庫 = settings.猜歌大挑戰題庫;
// 靜態文件服務（提供 HTML、CSS、JS、圖片等）
app.use(express.static(__dirname));

// 首頁路由 - 顯示開始遊戲.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});
app.get('/mainINFO', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'info.html'));
});
app.get('/CharacterGuessingGameInfo', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'CharacterGuessingGameInfo.html'));
});
app.get('/CharacterGuessingGame', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'CharacterGuessingGame.html'));
});
app.get('/SongGuessingGameInfo', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'SongGuessingGameInfo.html'));
});
app.get('/SongGuessingGame', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'SongGuessingGame.html'));
});
app.get('/GameAnswer', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'GameAnswer.html'));
});
app.get('/editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'editor.html'));
});
// API 路由 - 提供題目資料
app.get('/api/Character', (req, res) => {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    挖洞猜角色題庫 = settings.挖洞猜角色題庫;
    res.json(挖洞猜角色題庫);
});

app.get('/api/Song', (req, res) => {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    猜歌大挑戰題庫 = settings.猜歌大挑戰題庫;
    res.json(猜歌大挑戰題庫);
});

// API 路由 - 讀取設定
app.get('/api/settings', (req, res) => {
    res.json(settings);
});

// API 路由 - 保存設定
app.post('/api/settings', (req, res) => {
    try {
        const newSettings = req.body;
        
        // 驗證必要的欄位
        if (!newSettings.挖洞猜角色題庫 || !newSettings.猜歌大挑戰題庫) {
            return res.status(400).json({ error: '缺少必要欄位' });
        }
        
        // 將新設定寫入 JSON 文件
        fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
        
        // 更新內存中的設定
        Object.assign(settings, newSettings);
        
        res.json({ success: true, message: '設定已保存' });
    } catch (error) {
        console.error('保存設定失敗:', error);
        res.status(500).json({ error: '保存設定失敗: ' + error.message });
    }
});
// API 路由 - 上傳檔案到題庫
app.post('/api/upload', upload.single('file'), (req, res) => {
    req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf-8');
    try {
        if (!req.file) {
            return res.status(400).json({ error: '沒有選擇檔案' });
        }
        
        const type = req.query.type || 'Character';
        const filename = req.file.originalname;
        res.json({ 
            success: true, 
            message: '檔案上傳成功',
            filename: filename,
            type: type
        });
    } catch (error) {
        console.error('上傳檔案失敗:', error);
        res.status(500).json({ error: '上傳檔案失敗: ' + error.message });
    }
});

// API 路由 - 列出題庫中的檔案
app.get('/api/files', (req, res) => {
    try {
        const type = req.query.type || 'Character';
        const uploadDir = type === 'Character' ? CharacterUploadDir : songUploadDir;
        
        if (!fs.existsSync(uploadDir)) {
            return res.json({ files: [] });
        }
        
        const files = fs.readdirSync(uploadDir, { encoding: 'utf8' }).filter(file => {
            const stat = fs.statSync(path.join(uploadDir, file));
            return stat.isFile();
        });
        
        res.json({ files: files, type: type });
    } catch (error) {
        console.error('列出檔案失敗:', error);
        res.status(500).json({ error: '列出檔案失敗: ' + error.message });
    }
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`🎮 遊戲伺服器已啟動！`);
    console.log(`📍 遊戲地址: http://${getLocalIPAddress()}`);
    console.log(`📍 答案地址: http://${getLocalIPAddress()}/GameAnswer`);
    console.log(`📍 題目編輯器地址: http://${getLocalIPAddress()}/editor`);
});
