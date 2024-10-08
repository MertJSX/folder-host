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
const CryptoJS = require("crypto-js");
const jwt = require('jsonwebtoken');
const { logAction } = require("./log");

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
    fs.mkdirSync(config.folder);
}


// Multer storage

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = `${config.folder}${req.query.path}`;

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        let path = req.query.path;
        let fileName = file.originalname;

        if (path.slice(-1) !== "/") {
            path = path + "/"
        }

        if (fs.existsSync(`${config.folder}${req.query.path}${fileName}`)) {
            let i = 0;
            let memoryName = fileName;
            while (fs.existsSync(`${config.folder}${req.query.path}${fileName}`)) {
                i++;
                let extension = pathlib.extname(`${config.folder}${req.query.path}${memoryName}`);
                let name = pathlib.basename(`${config.folder}${req.query.path}${memoryName}`, extension)
                fileName = `${name} (${i})${extension}`;
            }
        }

        cb(null, fileName);
    },
});


routes.post("/verify-password", (req, res) => {
    let account = config.accounts
        .find((account) => { return account.name === req.body.username })

    let jwtToken = jwt.sign({
        name: account.name,
        password: account.password
    }, config.secret_jwt_key, { expiresIn: '24h' });

    let encryptedToken = CryptoJS.AES.encrypt(jwtToken, config.secret_encryption_key).toString();

    logAction(req.body.account.name, "Logged in", `Token: ${encryptedToken}`, config);

    res.status(200);
    res.json({
        res: "Verified!",
        token: encryptedToken,
        permissions: account.permissions
    })
})

routes.post("/read-dir", async (req, res) => {

    if (!req.body.account.permissions.read_directories) {
        res.status(403)
        res.json({ err: "No permission!" })
        return
    }

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
        directoryInfo = new DirItem(folderName, getParent(dirPath), dirPath, directoryData.isDirectory(), directoryData.birthtime, directoryData.mtime, await getTotalSize(`${config.folder}${path}`))
    }

    if (path === "/" && config.storage_limit) {
        directoryInfo.storage_limit = config.storage_limit;
    } else if (path === "/" && !config.storage_limit) {
        directoryInfo.storage_limit = "UNLIMITED"
    }

    let data = await getDirItems(`${config.folder}${path}`, mode, config);

    let isEmpty = false;

    if (!data[0]) {
        isEmpty = true;
    }

    logAction(req.body.account.name, "Readed Directory", `${config.folder}${path}`, config);

    res.status(200);
    res.json({
        data: data,
        isEmpty: isEmpty,
        res: "Successfully readed!",
        directoryInfo: directoryInfo,
        permissions: req.body.account.permissions
    })
})

routes.post("/read-file", (req, res) => {

    let path;
    let itemStat;
    let fileName;
    let lastModified;

    if (!req.body.account.permissions.read_files) {
        res.status(403)
        res.json({ err: "No permission!" })
        return
    }

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
        lastModified = itemStat.mtime;
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
            console.error(err);
            res.status(520);
            res.json({ err: "Unknown error!" })
        } else {
            logAction(req.body.account.name, `Readed File (${pathlib.basename(path)})`, `${config.folder}${path}`, config);
            res.status(200);
            res.json({ data: data, res: "Successfully readed!", title: fileName, lastModified: lastModified, writePermission: req.body.account.permissions.change })
        }
    });
})

routes.post("/download", (req, res) => {
    let path;
    if (!req.body.account.permissions.download) {
        res.status(403)
        res.json({ err: "No permission!" })
        return
    }

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

    logAction(req.body.account.name, "Downloaded File", `${config.folder}${path}`, config);

    res.status(200);
    res.download(`${config.folder}${path}`)

})

routes.post("/upload", async (req, res) => {

    let path = req.query.path;
    let account = req.body.account;

    if (!req.body.account.permissions.upload) {
        res.status(403)
        res.json({ err: "No permission!" })
        return
    }

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

    let remainingFreeSpace = await getRemainingFolderSpace(config);

    const upload = multer({ storage: storage, limits: { fileSize: remainingFreeSpace } }).single("file")

    upload(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                res.status(413);
                res.json({ err: `File too large! Remaining free space is: ${convertBytes(remainingFreeSpace)}` })
                return
            }
            res.status(520);
            res.json({ err: "Unknown error!" })
            return
        }

        let filepath = `${config.folder}${req.query.path}`;

        if (!filepath.endsWith("/")) {
            filepath += "/";
        }


        logAction(account.name, "Uploaded File", `${filepath}${req.file.filename}`, config);
        res.status(200);
        res.json({ response: "Successfully uploaded!" })
    })
})

routes.post("/delete", async (req, res) => {

    let path;
    let itemName;
    let recovery_bin = config.recovery_bin;

    if (!req.body.account.permissions.delete) {
        res.status(403)
        res.json({ err: "No permission!" })
        return
    }

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
            await removeDir(`${config.folder}${path}`);
            logAction(req.body.account.name, "Deleted directory", `${config.folder}${path}`, config);
            res.status(200)
            res.json({ response: "Deleted!" })
            return;
        } else if (!recovery_bin) {
            fs.unlink(`${config.folder}${path}`, (err) => {
                if (err) {
                    res.status(520)
                    res.json({ err: "Unknown error" })
                } else {
                    logAction(req.body.account.name, "Deleted file", `${config.folder}${path}`, config);
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
                    sizeOfFileToBeDeleted = await getTotalSize(`${config.folder}${path}`, false);
                }

                let sizeOfRecoveryBin = await getTotalSize("./recovery_bin", false);
                let totalSize = sizeOfFileToBeDeleted + sizeOfRecoveryBin;

                if (totalSize > bin_storage_limit) {
                    res.status(413)
                    res.json({ err: "This item exceeds the maximum recovery bin size." })
                    return;
                }
            }

            await fs.promises.rename(`${config.folder}${path}`, `./recovery_bin/${itemName}`);
            logAction(req.body.account.name, "Moved to recovery_bin", `${config.folder}${path}`, config);
            res.status(200);
            res.json({ response: "Moved to recovery_bin!" })
            return;
        }
    }

})

routes.post("/write-file", async (req, res) => {

    let filepath = req.query.path;
    let itemType = req.body.itemType; // folder or file
    let itemName = req.body.itemName;
    let content = req.body.content;
    let type = req.query.type; // create or change
    let lastModified;

    // console.log("New content size is: ".yellow);
    // console.log(getStringSize(content));

    // Check permissions

    if (type === "change" && !req.body.account.permissions.change) {
        res.status(403);
        res.json({ err: "No permission!" })
        return
    } else if (type === "create" && !req.body.account.permissions.create) {
        res.status(403);
        res.json({ err: "No permission!" })
        return
    }

    if (filepath && type) {
        if (type === "create" && (itemType === "file" || itemType === "folder") && (itemName !== "" && itemName !== undefined && itemName !== null)) {
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

    if (fs.existsSync(`${config.folder}${filepath}/${itemName}`) && type === "create") {
        res.status(400);
        res.json({ err: "Already exist!" })
        return;
    } else if (!fs.existsSync(`${config.folder}${filepath}`) && type === "change") {
        res.status(400)
        res.json({ err: "The folder doesn't exist!" })
        return;
    }
    if (type === "create" && itemType === "folder" && itemName !== undefined) {
        await fs.promises.mkdir(`${config.folder}${filepath}${itemName}`)
        logAction(req.body.account.name, "Created Item", `${config.folder}${filepath}${itemName}`, config);
        res.status(200);
        res.json({ response: "Folder created!" })
        return;
    } else if (type === "create" && itemType === "file" && itemName !== undefined) {
        await fs.promises.writeFile(`${config.folder}${filepath}${itemName}`, "");
        logAction(req.body.account.name, "Created Item", `${config.folder}${filepath}${itemName}`, config);
        res.status(200);
        res.json({ response: "File created!" })
        return;
    } else if (type === "change") {
        // Instead of this we use socket.io emits.
        await fs.promises.writeFile(`${config.folder}${filepath}`, content);
        lastModified = fs.statSync(`${config.folder}${filepath}`);
        res.status(200);
        res.json({ response: "Saved!", lastModified: lastModified.mtime })
        return;
    } else {
        res.status(520)
        res.json({ err: "Unknown error!" })
    }
})

routes.post("/create-copy", async (req, res) => {

    let path = req.query.path;
    let parentPath;
    let basename;
    let copyPath;
    let extname = null;

    // Check permissions

    if (!req.body.account.permissions.copy) {
        res.status(403);
        res.json({ err: "No permission!" })
        return
    }

    if (!fs.existsSync(`${config.folder}${path}`)) {
        res.status(400)
        res.json({ err: "The item doesn't exist!" })
        return;
    } else {
        parentPath = pathlib.dirname(path);
        basename = `${pathlib.basename(path)} - Copy`;
        let pathStat = fs.statSync(`${config.folder}${path}`);
        let index = 0;
        if (pathStat.isFile()) {
            extname = pathlib.extname(path);
            copyPath = `${parentPath}/${basename}${extname}`;
            if (config.storage_limit) {
                let fileSize = pathStat.size;
                let remainingFreeSpace = await getRemainingFolderSpace(config);

                console.log(convertBytes(fileSize), convertBytes(remainingFreeSpace));
                
                if (fileSize > remainingFreeSpace) {
                    res.status(507);
                    res.json({err: "Not enough space!"});
                    return
                }
            }
            while (fs.existsSync(`${config.folder}${copyPath}`)) {
                index++;
                copyPath = `${parentPath}/${basename} (${index})${extname}`;
            }
            fs.cp(`${config.folder}${path}`, `${config.folder}${copyPath}`, (err) => {
                if (err) {
                    res.status(520);
                    res.json({ response: "Unknown error!" })
                    return
                }
                logAction(req.body.account.name, "Copied File", `${config.folder}${path}`, config);
                res.status(200);
                res.json({ response: "Copied!" })

            });
        } else {
            if (config.storage_limit) {
                let folderSize = await getTotalSize(`${config.folder}${path}`, false);
                let remainingFreeSpace = await getRemainingFolderSpace(config);

                console.log(convertBytes(folderSize), convertBytes(remainingFreeSpace));
                
                
                if (folderSize > remainingFreeSpace) {
                    res.status(507);
                    res.json({err: "Not enough space!"});
                    return
                }
            }
            copyPath = `${parentPath}/${basename}`;
            while (fs.existsSync(`${config.folder}${copyPath}`)) {
                index++;
                copyPath = `${parentPath}/${basename} (${index})`;
            }
            fs.cp(`${config.folder}${path}`, `${config.folder}${copyPath}`, { recursive: true }, (err) => {
                if (err) {
                    res.status(520);
                    res.json({ response: "Unknown error!" })
                    return
                }
                logAction(req.body.account.name, "Copied Folder", `${config.folder}${path}`, config);
                res.status(200);
                res.json({ response: "Copied!" })
            });
        }
    }
})

routes.post("/rename-file", (req, res) => {

    let oldFilepath = req.query.oldFilepath;
    let oldFileName;
    let newFilepath = req.query.newFilepath;
    let newFilepathStat;
    let type = req.query.type; // create or change

    // Check permissions

    if (type === "rename" && !req.body.account.permissions.rename) {
        res.status(403);
        res.json({ err: "No permission!" })
        return
    } else if (type === "move" && !req.body.account.permissions.move) {
        res.status(403);
        res.json({ err: "No permission!" })
        return
    }

    if (type === "move") {
        newFilepathStat = fs.statSync(`${config.folder}${newFilepath}`)
        if (!newFilepathStat.isDirectory()) {
            res.status(400)
            res.json({ err: "The directory doesn't exist!" })
            return;
        }
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
        fs.rename(`${config.folder}${oldFilepath}`, `${config.folder}${newFilepath}${oldFileName}`, (err) => {
            if (err) {
                res.status(520);
                res.json({ err: "Unknown error!" })
                return
            }
            let oldPathPlaceholder = `${config.folder}${oldFilepath}`;
            let newPathPlaceholder = `${config.folder}${newFilepath}${oldFileName}`;
            logAction(req.body.account.name, "Moved Item", `${oldPathPlaceholder} => ${newPathPlaceholder}`, config);
        });
    } else {
        if (fs.existsSync(`${config.folder}${newFilepath}`)) {
            res.status(520);
            res.json({ err: "The destination already has a item named!" });
            return;
        }
        fs.rename(`${config.folder}${oldFilepath}`, `${config.folder}${newFilepath}`, (err) => {
            if (err) {
                res.status(520);
                res.json({ err: "Unknown error!" })
                return
            }
            let oldPathPlaceholder = `${config.folder}${oldFilepath}`;
            let newPathPlaceholder = `${config.folder}${newFilepath}`;
            logAction(req.body.account.name, "Renamed Item", `${oldPathPlaceholder} => ${newPathPlaceholder}`, config);
        });
    }

    res.status(200);
    res.json({ response: "Saved!" })
})


module.exports = routes