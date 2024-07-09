const express = require("express");
const app = express();
const fs = require("fs");
const colors = require("colors");
const yaml = require("js-yaml");
const { strings } = require("./strings");
const { getTotalSize, getDirItems } = require("./utils");
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

app.use(express.static(config.folder))
app.use(cors());
app.use(express.json());

// Get folder size on start

console.log("Total size:".green);
console.log(getTotalSize(config.folder));

config.permissions.read_directories ?
    app.get("/read-dir", (req, res) => {

        let path = "";
        let getFileSize = req.body.getFileSize !== undefined ?
            req.body.optimized : true;

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

        let data = getDirItems(`${config.folder}${path}`, getFileSize)
        res.status(200);
        res.json({
            data: data,
            res: "Successfully readed!"
        })
    })
    : console.log("/read-dir".yellow + " cancelled!".gray)


config.permissions.read_files ?
    app.get("/read-file", (req, res) => {

        let filepath;

        if (req.query.filepath) {
            filepath = req.query.filepath;
        } else {
            res.status(400);
            res.json({
                err: "Bad request!"
            })
            return
        }

        if (config.password) {
            if (req.query.password !== config.password) {
                res.status(400);
                res.json({ err: "Wrong password!" })
                return
            }
        }

        console.log(`${config.folder}${filepath}`);

        fs.readFile(`${config.folder}${filepath}`, "utf8", (err, data) => {
            if (err) {
                console.log(err);
            } else {
                res.status(200);
                res.json({ data: data })
            }
        });
    }) : console.log("/read-file".yellow + " cancelled!".gray)

!config.permissions.change && !config.permissions.create ?
    console.log("/write-file".yellow + " cancelled!".gray)
    : app.post("/write-file", (req, res) => {

        console.log(req.query);

        let filepath;
        let content;
        let type; // create or change

        // Check permissions

        if (req.query.type === "change" && !config.permissions.change) {
            res.status(403);
            res.json({ err: "You don't have permission!" })
            return
        } else if (req.query.type === "create" && !config.permissions.create) {
            res.status(403);
            res.json({ err: "You don't have permission!" })
            return
        }

        if (req.query.filepath && req.body.content && req.query.type) {
            filepath = req.query.filepath;
            content = req.body.content;

            if (type === "create") {
                type = "create";
            } else if (type === "change") {
                type = "change"
            } else {
                res.status(400);
                res.json({
                    err: "Bad request!"
                })
                return
            }
        } else {
            res.status(400);
            res.json({
                err: "Bad request!"
            })
            return
        }

        if (config.password) {
            if (req.query.password !== config.password) {
                res.status(400);
                res.json({ err: "Wrong password!" })
                return
            }
        }

        console.log(`${config.folder}${filepath}`);

        if (fs.existsSync(`${config.folder}${filepath}`) && type === "create") {
            res.status(200);
            res.json({ response: "Already exist!" })
            return;
        } else if (!fs.existsSync(`${config.folder}${filepath}`) && type === "change") {
            res.status(200)
            res.json({ response: "The file doesn't exist!" })
            return;
        }

        fs.writeFileSync(`${config.folder}${filepath}`, content);

        res.status(200);
        res.json({ response: "Saved!" })
    })

if (!abort) {
    app.listen(config.port, () => {
        console.log(`The server has started on port ${config.port}!`);
    })
}
