const express = require("express");
const app = express();
const fs = require("fs");
const colors = require("colors");
const yaml = require("js-yaml");
const { strings } = require("./strings");
const { getTotalSize, getDirItems, getParent, replacePathPrefix } = require("./utils");
const cors = require("cors");
const { DirItem } = require("./dir_item");
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


config.password ?
    app.get("/verify-password", (req, res) => {

        if (config.password) {
            if (req.query.password !== config.password) {
                res.status(200);
                res.json({ err: "Wrong password!" })
                return
            }
        }

        res.status(200);
        res.json({
            res: "Password is correct!"
        })
    })
    : console.log("/verify-password".yellow + " cancelled!".gray)

config.permissions.read_directories ?
    app.get("/read-dir", (req, res) => {

        let path = "";
        let getFileSize = req.body.getFileSize !== undefined ?
            false : true;

        console.log(req.query);

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

        if (path.slice(-1) !== "/") {
            path = path + "/";
        }


        // Validation to avoid errors

        if (!fs.existsSync(`${config.folder}${path}`)) {
            res.status(200);
            res.json({ err: "Wrong dirpath!" })
            return;
        } else {
            let item = fs.statSync(`${config.folder}${path}`);
            if (!item.isDirectory()) {
                res.status(200);
                res.json({ err: "Dirpath is not directory!" })
                return;
            }
        }


        let dirPath = `${config.folder}${path}`;
        let directoryData = fs.statSync(dirPath)
        const trimmedPath = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
        const folderName = trimmedPath.substring(trimmedPath.lastIndexOf('/') + 1);
        dirPath = replacePathPrefix(dirPath, `${config.folder}/`);
        let directoryInfo = new DirItem(folderName, getParent(dirPath), dirPath, directoryData.isDirectory(), directoryData.birthtime, directoryData.mtime, getTotalSize(`${config.folder}${path}`))

        let data = getDirItems(`${config.folder}${path}`, getFileSize, config);
        let isEmpty = false;

        if (!data[0]) {
            isEmpty = true;
        }

        res.status(200);
        res.json({
            data: data,
            isEmpty: isEmpty,
            res: "Successfully readed!",
            directoryInfo: directoryInfo
        })
    })
    : console.log("/read-dir".yellow + " cancelled!".gray)


config.permissions.read_files ?
    app.get("/read-file", (req, res) => {

        let path;

        if (req.query.filepath) {
            path = req.query.filepath;
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

        if (!fs.existsSync(`${config.folder}${path}`)) {
            res.status(200);
            res.json({ err: "Wrong filepath!" })
            return;
        } else {
            let item = fs.statSync(`${config.folder}${path}`);
            if (item.isDirectory()) {
                res.status(200);
                res.json({ err: "Filepath is a directory!" })
                return;
            }
        }

        fs.readFile(`${config.folder}${path}`, "utf8", (err, data) => {
            if (err) {
                console.log(err);
                res.status(200);
                res.json({ err: "Unknown error!" })
            } else {
                res.status(200);
                res.json({ data: data, res: "Successfully readed!" })
            }
        });
    }) : console.log("/read-file".yellow + " cancelled!".gray)


config.permissions.download ?
    app.get("/download", (req, res) => {

        let path;

        if (req.query.filepath) {
            path = req.query.filepath;
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

        if (!fs.existsSync(`${config.folder}${path}`)) {
            res.status(200);
            res.json({ err: "Wrong filepath!" })
            return;
        } else {
            let item = fs.statSync(`${config.folder}${path}`);
            if (item.isDirectory()) {
                res.status(200);
                res.json({ err: "You can't download a directory!" })
                return;
            }
        }


            res.status(200);
            res.download(`${config.folder}${path}`)

    }) : console.log("/read-file".yellow + " cancelled!".gray)


!config.permissions.change && !config.permissions.create ?
    console.log("/write-file".yellow + " cancelled!".gray)
    : app.post("/write-file", (req, res) => {

        console.log(req.query);

        let filepath = req.query.filepath;
        let content = req.body.content;
        let type = req.query.type; // create or change

        // Check permissions

        if (type === "change" && !config.permissions.change) {
            res.status(403);
            res.json({ err: "You don't have permission!" })
            return
        } else if (type === "create" && !config.permissions.create) {
            res.status(403);
            res.json({ err: "You don't have permission!" })
            return
        }

        if (filepath && content && type) {
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


!config.permissions.move && !config.permissions.rename ?
    console.log("/rename-file".yellow + " cancelled!".gray)
    : app.get("/rename-file", (req, res) => {

        console.log(req.query);

        let oldFilepath = req.query.oldFilepath;
        let oldFileName;
        let newFilepath = req.query.newFilepath;
        let type = req.query.type; // create or change

        // Check permissions

        if (type === "rename" && !config.permissions.rename) {
            res.status(403);
            res.json({ err: "You don't have permission!" })
            return
        } else if (type === "move" && !config.permissions.move) {
            res.status(403);
            res.json({ err: "You don't have permission!" })
            return
        }

        if (oldFilepath && newFilepath && type) {
            if (type === "rename") {
                type = "rename";
            } else if (type === "move") {
                type = "move"
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

        if (newFilepath.slice(-1) !== "/" && type === "move") {
            newFilepath = newFilepath + "/";
        }

        if (oldFilepath.slice(-1) === "/") {
            let item = oldFilepath.slice(0, -1);
            oldFileName = item.split("/").pop();
        } else {
            oldFileName = oldFilepath.split("/").pop();
        }

        if (!fs.existsSync(`${config.folder}${oldFilepath}`)) {
            res.status(200);
            res.json({ response: "The file doesn't exist!" })
            return;
        } else if (!fs.existsSync(`${config.folder}${getParent(newFilepath)}`)) {
            res.status(200)
            res.json({ response: "The file doesn't exist!" })
            return;
        }

        if (type === "move") {
            fs.renameSync(`${config.folder}${oldFilepath}`, `${config.folder}${newFilepath}${oldFileName}`);
        } else {
            fs.renameSync(`${config.folder}${oldFilepath}`, `${config.folder}${newFilepath}`);
        }

        res.status(200);
        res.json({ response: "Saved!" })
    })

if (!abort) {
    app.listen(config.port, () => {
        console.log(`The server has started on port ${config.port}!`);
    })
}
