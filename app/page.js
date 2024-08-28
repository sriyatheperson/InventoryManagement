'use client'
import Image from "next/image";
import {useState, useEffect} from 'react';
import {firestore} from '@/firebase';
import {Box, Button, Modal, TextField, Typography} from '@mui/material'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc } from "firebase/firestore";
import { Stack } from "@mui/system";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";

export default function Home() {

  const provider = new GoogleAuthProvider();
  const auth = getAuth();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userId, setUserId] = useState(null);

  const logIn = async() => {
    signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      console.log("some user info: ", user)
      setIsSignedIn(true)
      setUserId(user.uid)
    }).catch((error) => {
      // Handle Errors here.
      const errorCode = error.code;
      const errorMessage = error.message;
      // The email of the user's account used.
      console.log("error of code ", errorCode, "on the: ", errorMessage)
    });
  }
  return (
    <>
      {!isSignedIn ? (
        <Box width="100vw" 
        height="100vh" 
        display="flex" 
        justifyContent="center" 
        alignItems="center"
        flexDirection="column"
        gap={2}
        > 
          <Typography variant="h1"> Pantry Manager </Typography>
          <Typography variant="h4"> Track your pantry shelves with ease </Typography>
          <Button onClick={logIn} variant='contained'>Begin Now</Button>
        </Box>
      ) : (
        <Page userId={userId} />
      )}
    </>
  );
}

export function Page({ userId }) {
  const [inventory, setInventory] = useState([])
  const [open, setOpen] = useState(false)
  const [itemName, setItemName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSignedOut, setIsSignedOut] = useState(false)
  const userInventoryRef = collection(firestore, `users/${userId}/inventory`);
  const [openSec, setOpenSec] = useState(false)
  const [token, setToken] = useState("")
  const [recipie, setRecipie] = useState("")

  const logOut = async() => {
    const auth = getAuth();
    signOut(auth).then(() => {
      setIsSignedOut(true)
    }).catch((error) => {
      // An error happened.
    });
  }

  const updateInventory = async() => {
    const snapshot = query(userInventoryRef)
    const docs = await getDocs(snapshot)
    const inventoryList = []
    docs.forEach((doc)=> {
      inventoryList.push(
        {
          name: doc.id,
          ...doc.data(),
        }
      )
    });
    setInventory(inventoryList)
    console.log(inventoryList)
  }

  const removeItem = async(item) => {
    const docRef = doc(userInventoryRef, item)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const { quantity } = docSnap.data()
      if (quantity === 1) {
        await deleteDoc(docRef)
      } else {
        await setDoc(docRef, {quantity: quantity-1})
      }
    }

    await updateInventory()
  }

  const addItem = async(item) => {
    const docRef = doc(userInventoryRef, item)
    console.log(docRef)
    const docSnap = await getDoc(docRef)
    console.log(docSnap)
    if (docSnap.exists()) {
      const { quantity } = docSnap.data()
      await setDoc(docRef, {quantity: quantity+1})
    } else {
      await setDoc(docRef, {quantity: 1})
    }
    await updateInventory()
  }

  const searchItems = async(searchQuery) => {
    const snapshot = query(userInventoryRef)
    const docs = await getDocs(snapshot)
    console.log(searchQuery)
    if (searchQuery != "") {
      const inventoryList = []
      docs.forEach((doc)=> {
        if (doc.id.toLowerCase().includes(searchQuery.toLowerCase())) {
          inventoryList.push(
            {
              name: doc.id,
              ...doc.data(),
            }
          )
        }
      });
      setInventory(inventoryList)
    } else {
      await updateInventory()
    }
  }

  const callLlama = async() => {
    const inventoryList = []
    inventory.forEach( (doc) =>
      inventoryList.push(doc.name)
    )
    console.log("the inventory as a string: ", inventoryList.toString())
    const prompt = `Given the following list of ingredients: ${inventoryList.toString()}, 
    generate ONE recipe using as many of the ingredients as possible for the user to try. 
    Format your response as a STRING and first return the list of ingredients we need after 
    Ingredients: and then return instructions to follow AS A NUMBERED LIST after Instructions: . 
    DO NOT INCLUDE ANY ADDITIONAL TEXT BEFORE Ingredients: OR ANY TEXT AFTER THE NUMBERED LIST. 
    YOU MUST FOLLOW THIS FORMAT AND YOU MUST ALWAYS RETURN A RECIPE EVEN IF YOU 
    THINK THERE ARE NO GOOD ONES.`;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "meta-llama/llama-3.1-8b-instruct:free", 
        "messages": [
          { "role": "user", "content": prompt }
        ]
      })
    });
    const data = await response.json();
    console.log("the data from ai: ", data)
    console.log("the headers I passed: ", `Bearer ${token}`)
    const responseText = data.choices[0].message.content
    
    // Split the text into ingredients and instructions
    let parts = responseText.split("Instructions:");
    let ingredients = parts[0].replace("Ingredients:", "Ingredients:\n").trim();
    let instructions = "Instructions:\n" + parts[1].trim();

    // Add new lines before each numbered step in instructions
    instructions = instructions.replace(/(\d+\.)/g, "\n$1");

    // Combine the formatted ingredients and instructions
    let formattedText = "\n" + ingredients + "\n\n" + instructions;
    console.log("text with newlines", formattedText)
    setRecipie(formattedText);
  }

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)
  const handleOpenSec = () => setOpenSec(true)
  const handleCloseSec = () => setOpenSec(false)

  useEffect(
    () => { 
      updateInventory() 
    }, [])

  return (
    <>
      {!isSignedOut ? (
    <Box width="100vw" 
    display="flex" 
    justifyContent="center" 
    alignItems="center"
    flexDirection="column"
    gap={2}
    sx={{ p: 4 }}
    >
      <Box width={"90%"}>
      <Button onClick={logOut} variant='contained'>Sign Out</Button>
      </Box>
      <Box
      width={"70%"}
      gap={5}
      >
        <TextField 
              label="Search"
              variant="outlined" 
              fullWidth 
              value={searchQuery} 
              onChange={(e) => {
                searchItems(e.target.value)
                setSearchQuery(e.target.value)
              }}/>
      </Box>
      <Modal open = { open} onClose={handleClose}>  
        <Box
        position="absolute" top="50%" left="50%"
        width={400}
        bgcolor="white"
        border="2px solid #000"
        boxShadow={24}
        padding={4}
        display={"flex"}
        flexDirection={"column"}
        gap={3}
        sx={{transform: 'translate(-50%, -50%)'}}
        >
          <Typography variant="h6"> Add Item </Typography>
          <Stack width="100%" direction="row" spacing={2}>
            <TextField 
              variant="outlined" 
              fullWidth 
              value={itemName} 
              onChange={(e) => {
                setItemName(e.target.value)
              }}/>
            <Button
              onClick={() => {
                addItem(itemName)
                setItemName('')
                handleClose()
              }}
            >Add</Button>
          </Stack>
        </Box>
      </Modal>
      <Button
        variant="contained"
        onClick={() => {
          handleOpen()
        }}
      >Add New Item</Button>
      <Box border="1px solid #333">
        <Box
          width="800px"
          height="100px"
          bgcolor="#ADD8E6"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Typography variant="h2" color="#333">Your Pantry</Typography>
        </Box>
      <Stack width="800px" height="300px" spacing={2} overflow={"auto"} >
          {
            inventory.map(({name, quantity})=>(
              <Box key={name} 
                width={"100%"} 
                minHeight={"150px"} 
                display={"flex"} 
                alignItems={"center"} 
                justifyContent={"space-between"}
                padding={5}>
                  <Typography variant="h3" color={"#333"} textAlign={"center"}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={5}
                  >
                  <Button size="large" onClick={() => addItem(name)}>+</Button>
                  <Typography variant="h3" color={"#333"} textAlign={"center"}>
                    {quantity}
                  </Typography>
                  <Button onClick={() => removeItem(name)}>-</Button>
                  </Stack>
              </Box>
            ))
          }
      </Stack>
      </Box>
      <Typography variant="h3"> Generate Recipies </Typography>
      <Typography variant="h6"> Given these ingredients, we can find the best new recipie for you to try! </Typography>
      <Modal open = {openSec} onClose={handleCloseSec}>  
        <Box
        position="absolute" top="50%" left="50%"
        width={400}
        bgcolor="white"
        border="2px solid #000"
        boxShadow={24}
        padding={4}
        display={"flex"}
        flexDirection={"column"}
        gap={3}
        sx={{transform: 'translate(-50%, -50%)'}}
        >
          <Typography variant="h6"> Your OpenRouter Token: </Typography>
          <Stack width="100%" direction="row" spacing={2}>
            <TextField 
              variant="outlined" 
              fullWidth 
              value={token} 
              onChange={(e) => {
                console.log("updating openai token")
                setToken(e.target.value)
              }}/>
            <Button
              onClick={() => {
                callLlama()
                handleCloseSec()
                setToken("")
              }}
            >Generate!</Button>
          </Stack>
        </Box>
      </Modal>
      <Button
        variant="contained"
        onClick={() => {
          handleOpenSec()
        }}
      >Generate Recipies</Button>
      <Box width="800px" >
        <Typography display="block" style={{whiteSpace: "pre-wrap"}}> {recipie} </Typography>
      </Box>
    </Box>) : (
        <Home/>
      )}
    </>);
}
