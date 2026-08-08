const todoInput = document.getElementById("todo-input");
const addButton = document.getElementById("add-button");
const todoList = document.getElementById("todo-list");

addButton.addEventListener("click", addTodo);

todoInput.addEventListener("keydown", function(event){
    if (event.key === "Enter") {
        addTodo();
    }
})

function addTodo() {
    const todoText = todoInput.value;

    const todoItem = document.createElement("li");

    const todoTextElement = document.createElement("span");
    todoTextElement.textContent = todoText;

    todoTextElement.addEventListener("click", function() {
        todoTextElement.classList.toggle("completed");
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", function() {
        todoItem.remove();
    });

    todoItem.appendChild(todoTextElement);
    todoItem.appendChild(deleteButton);

    todoList.appendChild(todoItem);
}