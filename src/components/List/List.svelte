<script>
    import Error from "./Error.svelte";

    import { activeFocus } from "../../store";
    
    // set the active tab
    let active;
    activeFocus.subscribe((value) => {
        active = value;
    });
</script>

<div class='container'>
    <Error title={'Error 1'} id={0} is_focus={active} desc={"This is an error"}/>
    <Error title={'Error 2'} id={1} is_focus={active} desc={"This is an error of an error"}/>
    <Error title={'Error 2'} id={2} is_focus={active} desc={"This is an error of an error"}/>
    <Error title={'Error 2'} id={3} is_focus={active} desc={"This is an error of an error"}/>
    <Error title={'Error 2'} id={4} is_focus={active} desc={"This is an error of an error"}/>
    <Error title={'Error 2'} id={5} is_focus={active} desc={"This is an error of an error"}/>
    <Error title={'Error 2'} id={6} is_focus={active} desc={"This is an error of an error"}/>
    <Error title={'Error 2'} id={5} is_focus={active} desc={"This is an error of an error"}/>
    <Error title={'Error 2'} id={6} is_focus={active} desc={"This is an error of an error"}/>
</div>

<style>
    .container {
        padding:16px;
        display:flex;
        flex-direction: column;
        gap:8px;;
        align-items: stretch;
        overflow-y: scroll;
        height: 80vh;
    }
</style>