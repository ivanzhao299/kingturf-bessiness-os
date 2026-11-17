import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('oci_image_transport',ROOT/'scripts/oci_image_transport.py')
ot=importlib.util.module_from_spec(spec)
spec.loader.exec_module(ot)
INDEX='application/vnd.oci.image.index.v1+json'
MANIFEST='application/vnd.oci.image.manifest.v1+json'
CONFIG='application/vnd.oci.image.config.v1+json'


class OciTransportTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        (self.root/'blobs/sha256').mkdir(parents=True)

    def tearDown(self):
        self.temp.cleanup()

    def blob(self,content,media):
        raw=content if isinstance(content,bytes) else json.dumps(content).encode()
        digest='sha256:'+hashlib.sha256(raw).hexdigest()
        (self.root/'blobs/sha256'/digest[7:]).write_bytes(raw)
        return {'mediaType':media,'digest':digest,'size':len(raw)}

    def fixture(self,platform='amd64'):
        layer=self.blob(b'compressed-layer','application/vnd.oci.image.layer.v1.tar+gzip')
        config=self.blob({'os':'linux','architecture':platform,'rootfs':{'type':'layers','diff_ids':['sha256:'+'b'*64]}},CONFIG)
        manifest=self.blob({'schemaVersion':2,'mediaType':MANIFEST,'config':config,'layers':[layer]},MANIFEST)
        descriptor=manifest|{'platform':{'os':'linux','architecture':platform}}
        index=self.blob({'schemaVersion':2,'mediaType':INDEX,'manifests':[descriptor]},INDEX)
        return index,manifest,config,layer

    def test_root_platform_config_and_layer_identities_are_distinct(self):
        index,manifest,config,layer=self.fixture()
        identity,content=ot.verify_layout(self.root,index['digest'])
        self.assertEqual(identity['manifest_digest'],manifest['digest'])
        self.assertEqual(identity['config_digest'],config['digest'])
        self.assertEqual(identity['layers'],[layer])
        self.assertEqual(len(content),4)
        self.assertEqual(len({index['digest'],manifest['digest'],config['digest']}),3)

    def test_approved_digest_cannot_be_substituted_with_config(self):
        _,_,config,_=self.fixture()
        with self.assertRaises((RuntimeError,KeyError)):
            ot.verify_layout(self.root,config['digest'])

    def test_same_size_corruption_fails(self):
        index,_,_,layer=self.fixture()
        p=self.root/'blobs/sha256'/layer['digest'][7:]
        p.write_bytes(b'X'*p.stat().st_size)
        with self.assertRaisesRegex(RuntimeError,'checksum'):
            ot.verify_layout(self.root,index['digest'])

    def test_interrupted_transfer_missing_blob_fails(self):
        index,_,_,layer=self.fixture()
        (self.root/'blobs/sha256'/layer['digest'][7:]).unlink()
        with self.assertRaisesRegex(RuntimeError,'Missing'):
            ot.verify_layout(self.root,index['digest'])

    def test_truncated_blob_fails(self):
        index,_,_,layer=self.fixture()
        p=self.root/'blobs/sha256'/layer['digest'][7:]
        p.write_bytes(p.read_bytes()[:-1])
        with self.assertRaisesRegex(RuntimeError,'checksum'):
            ot.verify_layout(self.root,index['digest'])

    def test_missing_target_platform_fails(self):
        index,*_=self.fixture('arm64')
        with self.assertRaisesRegex(RuntimeError,'platform missing'):
            ot.verify_layout(self.root,index['digest'])

    def test_descriptor_size_is_binding_even_when_hash_matches(self):
        _,manifest,_,_=self.fixture()
        index=self.blob({'schemaVersion':2,'mediaType':INDEX,'manifests':[manifest|{'size':1,'platform':{'os':'linux','architecture':'amd64'}}]},INDEX)
        with self.assertRaisesRegex(RuntimeError,'size'):
            ot.verify_layout(self.root,index['digest'])

    def test_attestation_blobs_also_must_exist(self):
        index,manifest,_,_=self.fixture()
        attestation=self.blob({'schemaVersion':2,'mediaType':MANIFEST,'config':self.blob({},CONFIG),'layers':[self.blob(b'attestation','application/vnd.in-toto+json')]},MANIFEST)
        index=self.blob({'schemaVersion':2,'mediaType':INDEX,'manifests':[manifest|{'platform':{'os':'linux','architecture':'amd64'}},attestation|{'platform':{'os':'unknown','architecture':'unknown'}}]},INDEX)
        ot.verify_layout(self.root,index['digest'])
        (self.root/'blobs/sha256'/attestation['digest'][7:]).unlink()
        with self.assertRaisesRegex(RuntimeError,'Missing'):
            ot.verify_layout(self.root,index['digest'])

    def test_symlinked_blob_cannot_escape_layout(self):
        index,_,_,layer=self.fixture()
        p=self.root/'blobs/sha256'/layer['digest'][7:]
        original=p.read_bytes();p.unlink()
        other=self.root/'outside';other.write_bytes(original);p.symlink_to(other)
        with self.assertRaisesRegex(RuntimeError,'redirected'):
            ot.verify_layout(self.root,index['digest'])

    def test_real_http_head_get_and_namespace_are_scoped(self):
        index,*_=self.fixture()
        _,content=ot.verify_layout(self.root,index['digest'])
        server=ot.registry({'kingturf-erp-api':content})
        worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
        try:
            base=f'http://127.0.0.1:{ot.PORT}/v2/kingturf-erp-api/manifests/'+index['digest']
            with urllib.request.urlopen(urllib.request.Request(base,method='HEAD')) as response:
                self.assertEqual(response.headers['Docker-Content-Digest'],index['digest'])
                self.assertEqual(int(response.headers['Content-Length']),index['size'])
                self.assertEqual(response.read(),b'')
            with urllib.request.urlopen(base) as response:
                self.assertEqual('sha256:'+hashlib.sha256(response.read()).hexdigest(),index['digest'])
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(base.replace('kingturf-erp-api','other'))
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(base.replace(index['digest'],'sha256:'+'f'*64))
        finally:
            server.shutdown();server.server_close();worker.join()


if __name__=='__main__':
    unittest.main()
