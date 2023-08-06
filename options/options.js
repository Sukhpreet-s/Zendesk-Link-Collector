// LATER:
// - Edit?

function deleteLink(id) {
    browser.storage.sync.get('options').then(data => {
        if (data.options.length <= 0){
            //Shouldn't happen?
            return;
        }
        data.options.forEach((option) => {
            if (option.id == id) {
                data.options.splice(data.options.indexOf(option), 1);
            }
        });
        browser.storage.sync.set({options: data.options}).then( () => {
            load();
        });
    });
}

function load() {
    const linkTable = document.getElementById('table-link-patterns').tBodies[0];
    linkTable.innerHTML = '';
    browser.storage.sync.get('options').then(data => {
        if (data.options == undefined || data.options.length <= 0){
            data.options = [];
        }
        data.options.forEach(option => {
            let html2add = '';
            const tr = document.createElement('tr');
            tr.id = option.id;
            html2add += `<td><strong>${option.title}</strong></td>`
            html2add += `<td><pre>${option.pattern}</pre></td>`
            html2add += `<td><input disabled="true" type="checkbox" name="showContext1" ${option.showParent == true ? 'checked' : ''}></td>`
            html2add += `<td><button>Delete</button></td>`
            html2add += `<td><button class="button-reorder-up">Up</button><button class="button-reorder-down">down</button></td>`
            tr.innerHTML = html2add;          
            linkTable.appendChild(tr)
            //Add event listeners to dynamic elements.
            document.querySelector(`[id = '${option.id}'] td button`).addEventListener('click', () => deleteLink(option.id));
            document.querySelector(`[id = '${option.id}'] td button.button-reorder-up`).addEventListener('click', () => reorder(option.id, -1));
            document.querySelector(`[id = '${option.id}'] td button.button-reorder-down`).addEventListener('click', () => reorder(option.id, 1));
        });
    });
}

function save() {
    browser.storage.sync.get('options').then(data => {
        if (data.options == undefined || data.options.length <= 0) {
            data.options = [];
        }
        data.options.push({
            id: Date.now(),
            title: document.getElementById('title').value,
            pattern: document.getElementById('pattern').value,
            showParent: document.getElementById('show-parent').checked
        })
        browser.storage.sync.set({options: data.options}).then( () => {
            load();
            document.getElementById('title').value = '';
            document.getElementById('pattern').value = '';
            document.getElementById('show-parent').checked = false;
        });
    });
    
}

function reorder(id, move) {
    browser.storage.sync.get('options').then(data => {
        if (data.options.length <= 0){
            //Shouldn't happen?
            return;
        }
        if (move == 0 || move == undefined) {
            //No move.
            return;
        }
        let found = false;
        data.options.forEach((option) => {
            if (option.id == id && !found) {
                found = true;
                let pOptionIndex = data.options.indexOf(option) + move;
                if (pOptionIndex < 0 || pOptionIndex >= data.options.length) {
                    //OOB array.
                    console.error("OOB array");
                    return;
                }
                let option2Move = data.options.splice(data.options.indexOf(option), 1)[0];
                data.options.splice(pOptionIndex, 0, option2Move);
            }
        });
        
        browser.storage.sync.set({options: data.options}).then( () => {
            load();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('save-button').addEventListener('click', () => save());
    load();
});