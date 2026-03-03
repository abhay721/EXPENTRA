import React from 'react'
import {BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom";

import Login from "./pages/Auth/Login";
import SignUP from "./pages/Auth/SignUp";
import Home from "./pages/Dashboard/Home";
import Income from "./pages/Dashboard/Income";
import Expense from "./pages/Dashboard/Expense";

import { Button } from 'react-bootstrap';

const App = () => {
  return (
 <>
<Router>
  <Routes>
     <Route path="/" element={<Root/>}/>
    <Route path="/login" exact element={<Login/>}/>
    <Route path="/signup" exact element={<SignUP/>}/>
    <Route path="/dashboard" exact element={<Home/>}/>
    <Route path="/income" exact element={<Income/>}/>
    <Route path="/expense" exact element={<Expense/>}/>

    
  </Routes>
</Router>
  
 </>
  )
}

export default App

const Root = ()=> {
const isAuthenticated = !!localStorage.getItem("token");
return isAuthenticated ?(
<Navigate to ="/dashboard"/>
):
(
  <Navigate to = "/login" />
)
}
