import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {acceptsGzip,createJsonCompressor} from './json-compression.mjs';

test('gzip negotiation respects explicit rejection, quality values and wildcard fallback',()=>{
 for(const header of ['gzip','br, gzip, deflate','GZIP; q=0.5','*;q=0.5','gzip;q=1.000, *;q=0'])assert.equal(acceptsGzip(header),true,header);
 for(const header of [undefined,'','br','gzip;q=0','gzip;q=0,*;q=1','gzip;q=2','gzip;q=invalid','gzip;q=1;q=0','gzip;q=0,gzip;q=1'])assert.equal(acceptsGzip(header),false,header);
});
test('large JSON roundtrips exactly and small or non-gzip responses stay plain',async()=>{
 const encode=createJsonCompressor(),value={text:'한글 합성 자료 '.repeat(1000)},result=await encode(value,'gzip');
 assert.equal(result.encoding,'gzip');assert.deepEqual(JSON.parse(gunzipSync(result.body)),value);assert.ok(result.body.length<Buffer.byteLength(JSON.stringify(value))/3);
 for(const [data,header]of [[{ok:true},'gzip'],[value,'gzip;q=0']]){const plain=await encode(data,header);assert.equal(plain.encoding,null);assert.deepEqual(JSON.parse(plain.body),data);}
});
test('bounded compression uses plain fallback while occupied, releases slots after failure, and keeps requests separate',async()=>{
 let release,calls=0;const encode=createJsonCompressor({maxConcurrent:1,compress:async body=>{calls++;await new Promise(resolve=>{release=resolve;});if(calls===1)throw new Error('synthetic failure');return gzipSync(body);}});
 const first=encode({text:'first'.repeat(1000)},'gzip');assert.equal(calls,1);
 const second=await encode({text:'second'.repeat(1000)},'gzip');assert.equal(second.encoding,null);assert.equal(JSON.parse(second.body).text,'second'.repeat(1000));assert.equal(calls,1);
 release();assert.equal((await first).encoding,null);
 const third=encode({text:'third'.repeat(1000)},'gzip');assert.equal(calls,2);release();assert.equal(JSON.parse(gunzipSync((await third).body)).text,'third'.repeat(1000));
});
