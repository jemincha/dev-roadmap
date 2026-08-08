const todoInput = document.getElementById("todo-input");
const addButton = document.getElementById("add-button");
const todoList = document.getElementById("todo-list");
let todos = [];

addButton.addEventListener("click", addTodo);

todoInput.addEventListener("keydown", function(event){
    if (event.key === "Enter") {
        addTodo();
    }
})


function addTodo() {

    const todoText = todoInput.value;

    if (todoText.trim() === "") {
        return;
    }

    const todo = {
        id: Date.now(),
        text: todoText,
        completed: false 
    };

    todos.push(todo);
    saveTodos();

    const todoElement = createTodoElement(todo);
    todoList.appendChild(todoElement);

    todoInput.value = "";
}


function createTodoElement(todo) {
    const todoItem = document.createElement("li");

    const todoTextElement = document.createElement("span");
    todoTextElement.textContent = todo.text;

    if (todo.completed) {
        todoTextElement.classList.add("completed");
    }

    todoTextElement.addEventListener("click", function() {
        todo.completed = !todo.completed;
        todoTextElement.classList.toggle("completed");
        saveTodos();
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", function() {
        todos = todos.filter(function(item){
            return item.id !== todo.id;
        });
    
        todoItem.remove();
        saveTodos();
    });

        


    todoItem.appendChild(todoTextElement);
    todoItem.appendChild(deleteButton);

    return todoItem;

}


function saveTodos() {
    localStorage.setItem("todos", JSON.stringify(todos));
}

function loadTodos() {
    const savedTodos = localStorage.getItem("todos");

    if (savedTodos) {
        todos = JSON.parse(savedTodos);
    }
}

function renderTodos() {
    todoList.innerHTML = "";

    todos.forEach(function(todo){
        const todoElement = createTodoElement(todo);
        todoList.appendChild(todoElement);
    });
}

loadTodos();
renderTodos();