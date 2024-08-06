const express = require("express");
const fs = require("fs");
const colors = require("colors");
const yaml = require("js-yaml");
const multer = require('multer');
const upload = multer();
const path = require("path");
const { strings } = require("./strings");
const {
    getTotalSize
} = require("./utils");
const cors = require("cors");
const routes = require("./routes");
const app = express();
const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
let config;
let abort = false;

if (!fs.existsSync("./config.yml") || fs.existsSync("./config.yaml")) {
    console.log("config.yml is missing...".yellow);
    console.log("Creating new config...".green);
    if (!fs.existsSync("./test")) {
        fs.mkdirSync("./test")
    }
    fs.writeFileSync("config.yml", strings.defaultConfig);
}

if (!fs.existsSync("./recovery_bin")) {
    console.log("recovery_bin is missing...".yellow);
    console.log("Creating new recovery_bin...".green);
    fs.mkdirSync("recovery_bin");
}

config = yaml.load(fs.readFileSync('config.yml', 'utf8'));

// Get config data on start

console.log(config);

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
    const username = socket.handshake.auth.username;
    const password = socket.handshake.auth.password;

    if (!socket.handshake.auth.username || !socket.handshake.auth.password) {
        const err = new Error('Bad request!');
        return next(err);
    }

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
    next();
});


const socketEvents = require('./socketEvents');
socketEvents(io, config);

app.use(cors());
app.use("/api", express.json());


app.use("/api", (req, res, next) => {
    let username;
    let password;

    if ((!req.body.username || !req.body.password) && (!req.headers.username || !req.headers.password)) {
        res.status(400);
        res.json({ err: "Bad request!" })
        return
    }
    if (req.body.username && req.body.password) {
        username = req.body.username;
        password = req.body.password;
    } else {
        username = req.headers.username;
        password = req.headers.password;
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
console.log("Total size:".green);
if (config.storage_limit) {
    console.log(`${getTotalSize(config.folder)} / ${config.storage_limit}`);
} else {
    console.log(getTotalSize(config.folder));
}

if (!abort) {
    httpServer.listen(config.port, () => {
        console.log(`The server has started on port ${config.port}!`);
    })
}
