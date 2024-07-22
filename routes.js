const routes = require("express").Router();
const {
    getTotalSize,
    getDirItems,
    getParent,
    replacePathPrefix,
    removeDir,
    convertStringToBytes,
    getStringSize,
    getRemainingFolderSpace,
    convertBytes
} = require("./utils");
const { strings } = require("./strings");
const colors = require("colors");
const { DirItem } = require("./dir_item");
const pathlib = require("path");
const multer = require("multer");
const fs = require("fs");
const yaml = require("js-yaml");

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



// Multer storage

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = `${config.folder}${req.query.path}`;

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        let path = req.query.path;
        let fileName = file.originalname;
        let changedName = file.originalname;

        console.log(fileName);

        if (path.slice(-1) !== "/") {
            path = path + "/"
        }

        console.log(`${config.folder}${req.query.path}${fileName}`);

        if (fs.existsSync(`${config.folder}${req.query.path}${fileName}`)) {
            let i = 0;
            while (fs.existsSync(`${config.folder}${req.query.path}${changedName}`)) {
                i++;
                let extension = pathlib.extname(`${config.folder}${req.query.path}${fileName}`);
                let name = pathlib.basename(`${config.folder}${req.query.path}${fileName}`, extension)
                changedName = `${name} (${i})${extension}`;
            }
        }
        cb(null, changedName);
    },
});


config.password ?
    routes.get("/verify-password", (req, res) => {
        res.status(200);
        res.json({
            res: "Password is correct!"
        })
    })
    : console.log("/api/verify-password".yellow + " cancelled!".gray)

config.permissions.read_directories ?
    routes.get("/read-dir", (req, res) => {

        let path = "";
        let mode = req.query.mode === "Optimized mode" ?
            "Optimized mode" : req.query.mode === "Quality mode" ? "Quality mode" : "Balanced mode";

        if (req.query.folder) {
            path = req.query.folder;
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
        let directoryInfo;
        if (mode === "Optimized mode") {
            directoryInfo = new DirItem(folderName, getParent(dirPath), dirPath, directoryData.isDirectory(), directoryData.birthtime, directoryData.mtime, "N/A")
        } else {
            directoryInfo = new DirItem(folderName, getParent(dirPath), dirPath, directoryData.isDirectory(), directoryData.birthtime, directoryData.mtime, getTotalSize(`${config.folder}${path}`))
        }

        if (path === "/" && config.storage_limit) {
            directoryInfo.storage_limit = config.storage_limit;
        } else if (path === "/" && !config.storage_limit) {
            directoryInfo.storage_limit = "UNLIMITED"
        }

        let data = getDirItems(`${config.folder}${path}`, mode, config);
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
    : console.log("/api/read-dir".yellow + " cancelled!".gray)


config.permissions.read_files ?
    routes.get("/read-file", (req, res) => {

        let path;
        let itemStat;
        let fileName;

        if (req.query.filepath) {
            path = req.query.filepath;
        } else {
            res.status(400);
            res.json({
                err: "Bad request!"
            })
            return
        }

        if (!fs.existsSync(`${config.folder}${path}`)) {
            res.status(200);
            res.json({ err: "Wrong filepath!" })
            return;
        } else {
            itemStat = fs.statSync(`${config.folder}${path}`);
            if (itemStat.isDirectory()) {
                res.status(200);
                res.json({ err: "Filepath is a directory!" })
                return;
            }
        }

        if (path.slice(-1) === "/") {
            let item = path.slice(0, -1);
            fileName = item.split("/").pop();
        } else {
            fileName = path.split("/").pop();
        }

        fs.readFile(`${config.folder}${path}`, "utf8", (err, data) => {
            if (err) {
                console.log(err);
                res.status(200);
                res.json({ err: "Unknown error!" })
            } else {
                +
                    res.status(200);
                res.json({ data: data, res: "Successfully readed!", title: fileName })
            }
        });
    }) : console.log("/api/read-file".yellow + " cancelled!".gray)


config.permissions.download ?
    routes.get("/download", (req, res) => {

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

    }) : console.log("/api/read-file".yellow + " cancelled!".gray)


config.permissions.upload ?
    routes.post("/upload",
        (req, res) => {

            let path = req.query.path;

            if (path === undefined) {
                res.status(400);
                res.json({
                    err: "Bad request!"
                })
                return
            }

            if (!fs.existsSync(`${config.folder}${path}`)) {
                res.status(400);
                res.json({ err: "Wrong filepath!" })
                return;
            } else {
                let item = fs.statSync(`${config.folder}${path}`);
                if (!item.isDirectory()) {
                    res.status(400);
                    res.json({ err: "Wrong filepath!" })
                    return;
                }
            }

            let remainingFreeSpace = getRemainingFolderSpace(config);

            const upload = multer({ storage: storage, limits: { fileSize: remainingFreeSpace } }).single("file")

            upload(req, res, (err) => {
                if (err.code === "LIMIT_FILE_SIZE") {
                    console.log(err);
                    res.status(413);
                    res.json({ err: `File too large! Remaining free space is: ${convertBytes(remainingFreeSpace)}` })
                    return
                }
                if (err) {
                    res.status(520);
                    res.json({ err: "Unknown error!" })
                    return
                }
                res.status(200);
                res.json({ response: "Successfully uploaded!" })
            })
        }) : console.log("/api/upload".yellow + " cancelled!".gray)


config.permissions.delete ?
    routes.get("/delete", (req, res) => {

        let path;
        let itemName;
        let recovery_bin = config.recovery_bin;

        // console.log("Recovery bin: " + recovery_bin);

        if (req.query.path) {
            path = req.query.path;
        } else {
            res.status(400);
            res.json({
                err: "Bad request!"
            })
            return
        }

        if (!fs.existsSync(`${config.folder}${path}`)) {
            res.status(400);
            res.json({ err: "Wrong path!" })
            return;
        } else {
            let item = fs.statSync(`${config.folder}${path}`);
            if (`${config.folder}${path}` === `${config.folder}/`) {
                res.status(400);
                res.json({ err: "You can't delete the main path!" })
                return;
            }
            if (item.isDirectory() && !recovery_bin) {
                removeDir(`${config.folder}${path}`);
                res.status(200)
                res.json({ response: "Deleted!" })
                return;
            } else if (!recovery_bin) {
                console.log(`${config.folder}${path}`);
                fs.unlink(`${config.folder}${path}`, (err) => {
                    if (err) {
                        console.log(err);
                        res.status(520)
                        res.json({ err: "Unknown error" })
                    } else {
                        res.status(200)
                        res.json({ response: "Deleted!" })
                    }
                    return;
                })
            } else {

                if (path.slice(-1) === "/") {
                    let item = path.slice(0, -1);
                    itemName = item.split("/").pop();
                } else {
                    itemName = path.split("/").pop();
                }

                if (fs.existsSync(`./recovery_bin/${itemName}`)) {
                    let i = 0;
                    while (fs.existsSync(`./recovery_bin/${itemName}`)) {
                        console.log(`./recovery_bin/${itemName}`);
                        i++;
                        itemName = `${pathlib.basename(path, pathlib.extname(path))} (${i})${pathlib.extname(path)}`;
                    }
                }

                let bin_storage_limit;

                if (config.bin_storage_limit) {
                    bin_storage_limit = convertStringToBytes(config.bin_storage_limit);
                    let fileToBeDeletedStat = fs.statSync(`${config.folder}${path}`)

                    let sizeOfFileToBeDeleted = fileToBeDeletedStat.size;

                    if (fileToBeDeletedStat.isDirectory()) {
                        sizeOfFileToBeDeleted = getTotalSize(`${config.folder}${path}`, false);
                    }

                    let sizeOfRecoveryBin = getTotalSize("./recovery_bin", false);
                    let totalSize = sizeOfFileToBeDeleted + sizeOfRecoveryBin;

                    if (totalSize > bin_storage_limit) {
                        res.status(413)
                        res.json({ err: "This item exceeds the maximum recovery bin size." })
                        return;
                    }
                }

                fs.renameSync(`${config.folder}${path}`, `./recovery_bin/${itemName}`);
                res.status(200)
                res.json({ response: "Moved to recovery_bin!" })
                return;
            }
        }

    }) : console.log("/api/delete".yellow + " cancelled!".gray)


!config.permissions.change && !config.permissions.create ?
    console.log("/api/write-file".yellow + " cancelled!".gray)
    : routes.post("/write-file", (req, res) => {

        let filepath = req.query.path;
        let itemType = req.body.itemType; // folder or file
        let itemName = req.body.itemName;
        let content = req.body.content;
        let type = req.query.type; // create or change

        console.log("New content size is: ".yellow);
        console.log(getStringSize(content));

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

        if (filepath && type) {
            if (type === "create" && (itemType === "file" || itemType === "folder")) {
                type = "create";
            } else if (type === "change" && content !== undefined) {
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

        console.log(`${config.folder}${filepath}${itemName}`);

        if (fs.existsSync(`${config.folder}${filepath}/${itemName}`) && type === "create") {
            if (itemType === "folder" && fs.statSync(`${config.folder}${filepath}/${itemName}`).isDirectory()) {
                res.status(400);
                res.json({ err: "Already exist!" })
                return;
            }
            if (itemType !== "folder" && !fs.statSync(`${config.folder}${filepath}/${itemName}`).isDirectory()) {
                res.status(400);
                res.json({ err: "Already exist!" })
                return;
            }
        } else if (!fs.existsSync(`${config.folder}${filepath}`) && type === "change") {
            res.status(400)
            res.json({ err: "The file doesn't exist!" })
            return;
        }

        if (type === "create" && itemType === "folder" && itemName !== undefined) {
            fs.mkdirSync(`${config.folder}${filepath}${itemName}`)
            res.status(200);
            res.json({ response: "Folder created!" })
        } else if (type === "create" && itemType === "file" && itemName !== undefined) {
            fs.writeFileSync(`${config.folder}${filepath}${itemName}`, "");
            res.status(200);
            res.json({ response: "File created!" })
        } else {
            fs.writeFileSync(`${config.folder}${filepath}`, content);
            res.status(200);
            res.json({ response: "Saved!" })
        }


    })


!config.permissions.move && !config.permissions.rename ?
    console.log("/api/rename-file".yellow + " cancelled!".gray)
    : routes.get("/rename-file", (req, res) => {

        let oldFilepath = req.query.oldFilepath;
        let oldFileName;
        let newFilepath = req.query.newFilepath;
        let newFilepathStat;
        let type = req.query.type; // create or change
        if (type === "move") {
            newFilepathStat = fs.statSync(`${config.folder}${newFilepath}`)
            if (!newFilepathStat.isDirectory()) {
                res.status(400)
                res.json({ err: "The directory doesn't exist!" })
                return;
            }
        }

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

        if (oldFilepath === newFilepath) {
            res.status(400);
            res.json({ err: "Same location!" })
            return
        }


        if (!fs.existsSync(`${config.folder}${oldFilepath}`)) {
            res.status(400);
            res.json({ err: "The file doesn't exist!" })
            return;
        }

        if (!fs.existsSync(`${config.folder}${newFilepath}`) && type === "move") {
            res.status(400)
            res.json({ err: "The file doesn't exist!" })
            return;
        }

        if (!fs.existsSync(`${config.folder}${getParent(newFilepath)}`) && type === "rename") {
            res.status(400)
            res.json({ err: "The file doesn't exist!" })
            return;
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

        if (type === "move") {
            if (fs.existsSync(`${config.folder}${newFilepath}${oldFileName}`)) {
                res.status(520);
                res.json({ err: "The destination already has a item named!" });
                return;
            }
            fs.renameSync(`${config.folder}${oldFilepath}`, `${config.folder}${newFilepath}${oldFileName}`);
        } else {
            if (fs.existsSync(`${config.folder}${newFilepath}`)) {
                res.status(520);
                res.json({ err: "The destination already has a item named!" });
                return;
            }
            fs.renameSync(`${config.folder}${oldFilepath}`, `${config.folder}${newFilepath}`);
        }

        res.status(200);
        res.json({ response: "Saved!" })
    })


module.exports = routes