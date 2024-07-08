const express = require("express");
const app = express();
const fs = require("fs");
const colors = require("colors");
const yaml = require("js-yaml");
const { strings } = require("./strings");
const cors = require("cors");
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


if (fs.existsSync("./config.yml")) {
    config = yaml.load(fs.readFileSync('config.yml', 'utf8'));
} else {
    config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));
}

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

app.use(express.static(config.folder))
app.use(cors());
app.use(express.json());

app.get("/read-files", (req, res) => {

    console.log(req.query);

    let path;

    if (req.query.folder) {
        path = req.query.folder;
    }

    if (config.password) {
        if (req.query.password !== config.password) {
            res.status(400);
            res.json({ err: "Wrong password!" })
            return
        }
    }

    fs.readdir(`${config.folder}${req.query.folder}`, { withFileTypes: true }, (err, files) => {
        if (err) {
            console.log(err);
        } else {
            res.status(200);
            res.json({
                files
            })
        }
    })


})

if (!abort) {
    app.listen(config.port, () => {
        console.log(`The server has started on port ${config.port}!`);
    })
}
