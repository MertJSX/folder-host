class DirItem {
    constructor(name, parentPath, path, isDirectory, birthDate, dateModified, size, id) {
        this.name = name;
        this.parentPath = parentPath;
        this.path = path;
        this.isDirectory = isDirectory;
        this.birthDate = birthDate;
        this.dateModified = dateModified;
        if (size) {
            this.size = size;
        }
        if (id || id === 0) {
            this.id = id;
        }
    }
}

module.exports = {DirItem}