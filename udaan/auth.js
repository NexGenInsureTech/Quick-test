function login(){
  let role = document.getElementById("userRole").value;
  localStorage.setItem("role", role);
  initApp();
}

function logout(){
  localStorage.clear();
  location.reload();
}

function initApp(){
  let role = localStorage.getItem("role");
  if(role){
    document.getElementById("login").style.display="none";
    document.getElementById("app").style.display="block";
    document.getElementById("roleTitle").innerText = role.toUpperCase()+" Dashboard";
  }
}

window.onload = initApp;
