const ouder1 = document.getElementById('rijksregister_ouder1');
const ouder2 = document.getElementById('rijksregister_ouder2');
const kind =  document.getElementById('rijksregister_kind');

['ouder1', 'ouder2', 'kind'].forEach(id => {
    new Cleave(`#rijksregister_${id}`, {
        blocks: [2, 2, 2, 3, 2],
        delimiters: ['.', '.', '-', '.'],
        numericOnly: true
    });
});
