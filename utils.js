const fs = require("fs")
const path = require("path")
const {DirItem} = require("./dir_item");

const getAllFiles = function (dirPath, arrayOfFiles) {
  let files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(__dirname, dirPath, file))
    }
  })

  // arrayOfFiles.forEach(function(filePath) {
  //     totalSize += fs.statSync(filePath).size
  // })

  return arrayOfFiles
}


const convertBytes = function (bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]

  if (bytes == 0) {
    return "N/A"
  }

  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))

  if (i == 0) {
    return bytes + " " + sizes[i]
  }

  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i]
}

function replacePathPrefix(fullPath, realPrefix) {
  if (fullPath.startsWith(realPrefix)) {
    return "./" + fullPath.slice(realPrefix.length);
  }
  return fullPath;
}

function getParent(filePath) {
  let lastIndex = filePath.lastIndexOf('/');
  if (lastIndex === -1) return filePath;

  let item = filePath.slice(0, lastIndex);

  if (item.length > 1) {
    return item;
  } else {
    return filePath.slice(0, lastIndex + 1);
  }
}


const getDirItems = function (dirPath, getFileSize, config) {
  let files = fs.readdirSync(dirPath, { withFileTypes: true })

  getFileSize === undefined ? getFileSize = true : null;

  let arrayOfItems = []

  files.forEach(function (file) {
    let fileStats = fs.statSync(dirPath + "/" + file.name);
    let isDirectory = fileStats.isDirectory();
    let size;
    let parentPath;

    if (file.parentPath === config.folder + "/") {
      // console.log(`${file.parentPath} === ${config.folder}`);
      parentPath = "./";
    } else {
      // console.log(`${file.parentPath} === ${config.folder}`);
      parentPath = replacePathPrefix(file.parentPath, `${config.folder}/`);
    }

    if (getFileSize) {
      size = fs.statSync(dirPath + "/" + file.name).size;
    }

    let item;

    getFileSize ?
    item = new DirItem(file.name, parentPath, `${parentPath}${file.name}`, isDirectory, fileStats.birthtime, fileStats.mtime, convertBytes(size))
    : item = new DirItem(file.name, parentPath, `${parentPath}${file.name}`, isDirectory, fileStats.birthtime, fileStats.mtime );

    arrayOfItems.push(item)
  })

  return arrayOfItems
}

const getTotalSize = function (directoryPath) {
  const arrayOfFiles = getAllFiles(directoryPath)

  //console.log(arrayOfFiles);

  let totalSize = 0

  arrayOfFiles.forEach(function (filePath) {
    totalSize += fs.statSync(filePath).size
  })

  return convertBytes(totalSize);
}



module.exports = { getTotalSize, getDirItems, getParent, replacePathPrefix };