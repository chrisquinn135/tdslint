<script>
    import Menu from '../components/Menu/Menu.svelte'
    import List from '../components/List/List.svelte';
</script>

<div class='body'>
    <Menu/>
    <List/>
</div>

<style>
    .body {
        display: grid;
        grid-template-columns: 1fr 2fr;
    }
</style>