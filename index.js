const express = require("express");
const app = express();
const fs = require("fs");
const colors = require("colors");
const yaml = require("js-yaml");
const path = require("path")
const { strings } = require("./strings");
const {
    getTotalSize
} = require("./utils");
const cors = require("cors");
const routes = require("./routes");
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

app.use(cors());
app.use(express.json());
app.use("/api",routes)

app.use("/api",(req, res, next) => {
    console.log(req.query);
    if (config.password) {
        if (req.query.password !== config.password) {
            res.status(401);
            res.json({ err: "Wrong password!" })
            return
        }
    }
    next()
})

app.use(express.static(path.join(__dirname ,"client")))

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname , "client", 'index.html'));
});

// Get folder size on start
console.log("Total size:".green);
if (config.storage_limit) {
    console.log(`${getTotalSize(config.folder)} / ${config.storage_limit}`);
} else {
    console.log(getTotalSize(config.folder));
}

if (!abort) {
    app.listen(config.port, () => {
        console.log(`The server has started on port ${config.port}!`);
    })
}
