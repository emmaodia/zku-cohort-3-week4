import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers } from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import { Formik, Field, Form, FormikHelpers } from 'formik'
import { object, number, string, ObjectSchema } from 'yup';

interface Values {
    name: string;
    age: number;
    address: string;
  }

interface NewGreeting {
    greeting: string;
  }

export default function Home() {
   
    const schema: ObjectSchema<Values> = object({
        name: string().defined(),
        age: number().optional(),
        address: string().defined()
      });

    const [state, setState] = React.useState("")
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>

                <Formik
                    initialValues={{
                    name: '',
                    age: 0,
                    address: '',
                    }}
                    onSubmit={(
                    values: Values,
                    { setSubmitting }: FormikHelpers<Values>
                    ) => {
                    setTimeout(() => {
                        console.log(JSON.stringify(values));
                        setSubmitting(false);
                    }, 500);
                    }}
                    >
                    <Form>
                        <label htmlFor="name">name</label>
                    <Field id="name" name="name" placeholder="Enter Name" />

                        <label htmlFor="age">age</label>
                    <Field id="age" name="age" placeholder="Enter Age" type="string"/>

                        <label htmlFor="address">address</label>
                    <Field
                        id="address"
                        name="address"
                        placeholder="Enter your address"
                        type="string"
                    />

                    <button type="submit">Submit</button>
                    </Form>
                </Formik>

                <Formik
                    initialValues={{
                    newGreeting: '',
                    }}
                    onSubmit={(
                    values: NewGreeting,
                    { setSubmitting }: FormikHelpers<NewGreeting>
                    ) => {
                    setTimeout(() => {
                        console.log(JSON.stringify(values));
                        setState(values.greeting)
                        setSubmitting(false);
                    }, 500);
                    }}
                    >
                    <Form>
                        <label htmlFor="newGreeting">name</label>
                    <Field id="newGreeting" name="greeting" placeholder="greeting" />


                    <button type="submit">New Greeting</button>

                    <h1 className={styles.title}>{state}</h1>

                    </Form>
                </Formik>

            </main>
        </div>
    )
}
