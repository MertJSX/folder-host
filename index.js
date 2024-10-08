const express = require("express");
const fs = require("fs");
const colors = require("colors");
const yaml = require("js-yaml");
const path = require("path");
const { strings } = require("./strings");
const {
    outputFolderSize,
    checkSecurityIssue
} = require("./utils");
const cors = require("cors");
const routes = require("./routes");
const CryptoJS = require("crypto-js");
const jwt = require('jsonwebtoken');
const app = express();
const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
let config;
let abort = false;

if (!fs.existsSync("./config.yml") || fs.existsSync("./config.yaml")) {
    console.log("config.yml is missing...".yellow);
    console.log("Creating new config...\n".green);
    if (!fs.existsSync("./test")) {
        fs.mkdirSync("./test")
    }
    fs.writeFileSync("config.yml", strings.defaultConfig);
}

if (!fs.existsSync("./recovery_bin")) {
    console.log("recovery_bin is missing...".yellow);
    console.log("Creating new recovery_bin...\n".green);
    fs.mkdirSync("recovery_bin");
}

config = yaml.load(fs.readFileSync('config.yml', 'utf8'));

if (!fs.existsSync(config.folder)) {
    console.log(`${config.folder} is missing...`.yellow);
    console.log(`Creating new ${config.folder}...\n`.green);
    fs.mkdirSync(config.folder);
}

// Get config data on start

// console.log(config);

if (!config.port) {
    console.log("Port is missing...".yellow);
    abort = true;
    setTimeout(() => {
        process.exit();
    }, 3000);
}

if (!config.folder) {
    console.log("Folder data is missing...".yellow);
    abort = true;
    setTimeout(() => {
        process.exit();
    }, 3000);
}

io.use((socket, next) => {
    let username;
    let password;

    if (!socket.handshake.auth.token) {
        const err = new Error('Bad request!');
        return next(err);
    }

    if (socket.handshake.auth.watch) {
        if (socket.handshake.auth.watch.match(/\/\.\./)) {
            
            const err = new Error('Bad request!');
            return next(err);
        }
    }

    const token = socket.handshake.auth.token;

    let bytes = CryptoJS.AES.decrypt(token, config.secret_encryption_key);
    bytes = bytes.toString(CryptoJS.enc.Utf8);
    let decoded;
    try {
        decoded = jwt.verify(bytes, config.secret_jwt_key);
    } catch (err) {
        if (err.message === "jwt expired") {
            const err = new Error('Session expired');
            err.data = { content: "Please try to login again." };
            return next(err);
        } else {
            const err = new Error('Unknown session error');
            err.data = { content: "Please try to login again." };
            return next(err);
        }
    }

    username = decoded.name;
    password = decoded.password;


    function findUser(account) {
        return account.name === username
    }

    let account = config.accounts.find(findUser);

    if (account !== undefined) {
        if (password !== account.password) {
            const err = new Error('Incorrect password');
            err.data = { content: "Your password is incorrect." };
            return next(err);
        }
    } else {
        const err = new Error('Wrong username!');
        err.data = { content: "That account does not exist." };
        return next(err);
    }

    socket.handshake.auth.account = account;

    next();
});


const socketEvents = require('./socketEvents');
socketEvents(io, config);

app.use(cors());
app.use("/api", express.json());


app.use("/api", async (req, res, next) => {
    let username;
    let password;

    if (!req.body.username || !req.body.password) {
        if (!req.body.token && !req.headers.token) {
            res.status(400);
            res.json({ err: "Bad request!" })
            return
        }
    }

    if (await checkSecurityIssue(req)) {
        res.status(400);
        res.json({ err: "Bad request!" })
        return
    }

    if (req.body.username && req.body.password) {
        username = req.body.username;
        password = req.body.password;
    } else if (req.body.token) {
        let bytes = CryptoJS.AES.decrypt(req.body.token, config.secret_encryption_key);
        bytes = bytes.toString(CryptoJS.enc.Utf8);
        let decoded;
        try {
            decoded = jwt.verify(bytes, config.secret_jwt_key);
        } catch (err) {
            if (err.message === "jwt expired") {
                res.status(401);
                res.json({ err: "Session expired!" })
                return
            } else {
                res.status(401);
                res.json({ err: "Unknown session error!" })
            }
            return
        }
        username = decoded.name;
        password = decoded.password;
    } else if (req.headers.token) {
        let bytes = CryptoJS.AES.decrypt(req.headers.token, config.secret_encryption_key);
        bytes = bytes.toString(CryptoJS.enc.Utf8);
        let decoded;
        try {
            decoded = jwt.verify(bytes, config.secret_jwt_key);
        } catch (err) {
            console.error(err.message);
            if (err.message === "jwt expired") {
                res.status(401);
                res.json({ err: "Session expired!" })
                return
            } else {
                res.status(401);
                res.json({ err: "Unknown session error!" })
            }
            return
        }
        username = decoded.name;
        password = decoded.password;
    } else {
        res.status(400);
        res.json({ err: "Bad request!" })
        return
    }

    function findUser(account) {
        return account.name === username
    }
    let account = config.accounts.find(findUser);

    if (account !== undefined) {
        if (password !== account.password) {
            res.status(401);
            res.json({ err: "Wrong password!" })
            return
        }
    } else {
        res.status(401);
        res.json({ err: "Wrong username!" })
        return
    }
    req.body.account = account;
    next()
})

app.use("/api", routes)
app.use("/", express.static(path.join(__dirname, "client")))

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", 'index.html'));
});


// Get folder size on start
if (config.get_foldersize_on_start && fs.existsSync(config.folder)) {
    outputFolderSize(config)
}

if (!abort) {
    httpServer.listen(config.port, () => {
        console.log(`
      _______   __   __
     / _____/  / /  / /
    / /__     / /__/ /
   / ___/    / ___  /
  / /       / /  / /
 /_/       /_/  /_/     `.cyan.bold, "By MertJSX".underline.brightCyan.italic);

        console.log(`\nThe server has started on port ${config.port}!`.gray);
        console.log("IP: ".gray + `http://127.0.0.1:${config.port}\n`.yellow);
    })
}
