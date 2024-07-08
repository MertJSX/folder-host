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

config.permissions.read_directories ? 
app.get("/read-dir", (req, res) => {

    let path = "";

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

    fs.readdir(`${config.folder}${path}`, { withFileTypes: true }, (err, files) => {
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

app.post("/write-file", (req, res) => {

    console.log(req.query);

    let filepath;
    let content;

    if (req.query.filepath) {
        filepath = req.query.filepath;
    } else {
        res.status(400);
        res.json({
            err: "Bad request!"
        })
        return
    }

    if (req.body.content) {
        content = req.body.content;
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

    fs.writeFileSync(`${config.folder}${filepath}`, content);

    res.status(200);
    res.json({ response: "Saved!" })
})

if (!abort) {
    app.listen(config.port, () => {
        console.log(`The server has started on port ${config.port}!`);
    })
}
