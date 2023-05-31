<script>
    import Menu from '../components/Menu/Menu.svelte'
    import List from '../components/List/List.svelte'
    import Button from '../components/Button.svelte';
</script>

<div class='container'>
    <div class='body'>
        <Menu/>
        <List/>
    </div>
    <div class='footer'>
        <Button type={'link'}>Link</Button>
        <Button type={'primary'}>TEST</Button>
    </div>
</div>


<style>
    .container {
        height: 653px;
        justify-content: flex-start;
        display: flex;
        flex-direction: column;
    }

    .body {
        flex-grow: 1;
        display: grid;
        grid-template-columns: 1fr 2fr;
    }

    .footer {
        background-color: white;
        padding: 16px 24px;
        display: flex;
        flex-direction: row;
        justify-content: flex-end; 
    }
</style>