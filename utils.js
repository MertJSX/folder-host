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


const getDirItems = function (dirPath, getFileSize) {
  let files = fs.readdirSync(dirPath, { withFileTypes: true })

  getFileSize === undefined ? getFileSize = true : null;

  let arrayOfItems = []

  files.forEach(function (file) {
    let isDirectory = fs.statSync(dirPath + "/" + file.name).isDirectory();
    let size;

    if (getFileSize) {
      size = fs.statSync(dirPath + "/" + file.name).size;
    }

    let item;

    getFileSize ?
    item = new DirItem(file.name, file.parentPath, isDirectory, convertBytes(size))
    : item = new DirItem(file.name, file.parentPath, isDirectory );

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



module.exports = { getTotalSize, getDirItems };