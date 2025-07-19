<?php
use PHPUnit\Framework\TestCase;

class FunctionsTest extends TestCase
{
    public function testExtractVideoIdValid()
    {
        $url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        $this->assertSame('dQw4w9WgXcQ', extract_video_id($url));
    }

    public function testExtractVideoIdInvalid()
    {
        $this->assertFalse(extract_video_id('not a url'));
    }

    public function testCreateTables()
    {
        $db = new SQLite3(':memory:');
        createTables($db);
        $tables = ['profiles','options','queue','downloaded','directories'];
        foreach ($tables as $table) {
            $exists = $db->querySingle("SELECT name FROM sqlite_master WHERE type='table' AND name='$table'");
            $this->assertSame($table, $exists);
        }
    }

    public function testDetermineQualityMin()
    {
        $profile = ['min_res' => '720'];
        $expected = '-f "bv*[height>=720]+ba/b[height>=720] / wv*+ba/w"';
        $this->assertSame($expected, determineQuality($profile));
    }

    public function testDetermineQualityMax()
    {
        $profile = ['max_res' => '480'];
        $expected = '-f "bv*[height<=480]+ba/b[height<=480] / wv*+ba/w"';
        $this->assertSame($expected, determineQuality($profile));
    }

    public function testDetermineQualityDefault()
    {
        $profile = [];
        $expected = '-f "bv*[height<=1080]+ba/b[height<=1080] / wv*+ba/w"';
        $this->assertSame($expected, determineQuality($profile));
    }
}
