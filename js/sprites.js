// Sprity kreslené kódem: pole řetězců ('X' = bod). Přední strana postav směřuje doprava.
(function (root) {
    'use strict';

    var MV = root.MV = root.MV || {};

    MV.SPR = {
        // korba vozítka 20x8 (kabina vzadu, dělo vpředu i vzadu)
        roverBody: [
            '...XXXXX............',
            '..X.....X...........',
            '..X.XXX.X.....X.....',
            '.XXXXXXXXXXXXXXXXX..',
            'XXXXXXXXXXXXXXXXXXXX',
            'XXXXXXXXXXXXXXXXXXXX',
            '.XXXXXXXXXXXXXXXXXX.',
            '..XXXXXXXXXXXXXXXX..'
        ],
        wheel: [
            ['.XXX.', 'X.X.X', 'XXXXX', 'X.X.X', '.XXX.'],
            ['.XXX.', 'XX.XX', 'X.X.X', 'XX.XX', '.XXX.']
        ],
        // astronaut 8x11, batoh vzadu (vlevo)
        astro: [
            [
                '...XXX..',
                '..XXXXX.',
                '..XX..X.',
                '..XXXXX.',
                '.XXXXXX.',
                'XXXXXXXX',
                'XXXXXXX.',
                '.XXXXXX.',
                '..XX.XX.',
                '..XX.XX.',
                '.XXX.XXX'
            ],
            [
                '...XXX..',
                '..XXXXX.',
                '..XX..X.',
                '..XXXXX.',
                '.XXXXXX.',
                'XXXXXXXX',
                'XXXXXXX.',
                '.XXXXXX.',
                '..XXXXX.',
                '...XXX..',
                '...XXXX.'
            ]
        ],
        flame: [['.X.', 'XXX', '.X.', '.X.'], ['XXX', '.X.', 'XXX', '.X.']],
        // moduly základny
        mod: [
            [   // 0 plošina 20x6
                '....XXXXXXXXXXXX....',
                '..XXXXXXXXXXXXXXXX..',
                'XXXXXXXXXXXXXXXXXXXX',
                'XX.XX.XX.XX.XX.XX.XX',
                'XXXXXXXXXXXXXXXXXXXX',
                '.XX..............XX.'
            ],
            [   // 1 věž 8x16
                '...XX...',
                '...XX...',
                '..XXXX..',
                '..X..X..',
                '..XXXX..',
                '..X..X..',
                '..XXXX..',
                '..X..X..',
                '..XXXX..',
                '.XXXXXX.',
                '.X.XX.X.',
                '.XXXXXX.',
                '.X.XX.X.',
                '.XXXXXX.',
                'XXXXXXXX',
                'XXXXXXXX'
            ],
            [   // 2 kupole 14x8
                '....XXXXXX....',
                '..XX......XX..',
                '.X..X.X.X...X.',
                '.X.X.X.X.X..X.',
                'XXXXXXXXXXXXXX',
                'X.XX.XX.XX.XX.',
                'XXXXXXXXXXXXXX',
                '.XXXXXXXXXXXX.'
            ]
        ],
        gem: [
            ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
            ['...X...', '..X.X..', '.X...X.', 'X..X..X', '.X...X.', '..X.X..', '...X...']
        ],
        // nepřátelé
        meteor: [
            ['..XXXX..', '.XXXXXX.', 'XXX.XXXX', 'XXXXXXXX', 'XXXXX.XX', '.XXXXXX.', '..XXXX..', '...XX...'],
            ['..XXXX..', '.XXXXXX.', 'XXXXXXXX', 'XX.XXXXX', 'XXXXXXXX', '.XXXX.X.', '..XXXX..', '...XX...']
        ],
        ufo: [
            ['....XXXX....', '...X.XX.X...', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', '..X..XX..X..'],
            ['....XXXX....', '...X.XX.X...', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', '.X..X..X..X.']
        ],
        ship: [
            ['..XXXX....', 'XXXXXXXXX.', '.XXXXXXXXX', '...XX.....'],
            ['..XXXX....', 'XXXXXXXXX.', '.XXXXXXXXX', '....XX....']
        ],
        bomb: ['.X.', 'XXX', 'XXX', 'XXX', '.X.'],
        bug: [
            ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', 'X.X..X.X', '.X.XX.X.'],
            ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', 'X.X..X.X']
        ],
        // ikona životu
        life: ['..XXX...', '.X...X..', 'XXXXXXX.', 'X.X.X.X.']
    };

    MV.KIND_NAME = ['PLOŠINA', 'VĚŽ', 'KUPOLE'];
    MV.KIND_SIZE = [[20, 6], [8, 16], [14, 8]];
})(typeof window !== 'undefined' ? window : globalThis);
