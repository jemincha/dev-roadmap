console.log("Calculator start");

const display = document.querySelector(".display");

const buttons = document.querySelectorAll("button");

let currentInput = "";
let previousInput = "";
let operator = "";

function updateDisplay(value){
    display.innerText = value;
}

function clear(){
    currentInput = "";
    previousInput = "";           
    operator = "";
    updateDisplay("0");
}

function inputNumber(value){
    currentInput += value;
    updateDisplay(currentInput);
}

function setOperator(value){
    previousInput = currentInput;
    currentInput = "";
    operator = value;
}

function calculate(){
    let result;

    if(operator === "+"){
                result = Number(previousInput) + Number(currentInput);
            }
            else if(operator === "-"){
                result = Number(previousInput) - Number(currentInput);
            }
            else if(operator === "*"){
                result = Number(previousInput) * Number(currentInput);
            }
            else if(operator === "/"){
                if(Number(currentInput) === 0){
                    result = "Error";
                }
                else {
                result = Number(previousInput) / Number(currentInput);
                }
            }

            return result;
}

function calculateResult(){
    let result = calculate();

    updateDisplay(result);

    currentInput = String(result);
    previousInput = "";
    operator = "";
}


buttons.forEach(function(button){
    button.addEventListener("click", function(){

        const value = button.innerText;

        if(value === "C"){
            clear();    
        }

        else if(value === "+" || value === "-" || value === "*" || value === "/"){

            setOperator(value);

        }

        else if(value === "="){
        
            calculateResult();
        }

        else {
            inputNumber(value);
        }
    })    
    
});