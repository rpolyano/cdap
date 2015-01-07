angular.module(PKG.name + '.feature.cdap-app')
  .controller('CdapAppListController', function CdapAppList( $timeout, $scope, MyDataSource, fileUploader, $alert, $state, $stateParams) {
    var data = new MyDataSource($scope);

    data.request({
      _cdapNsPath: '/apps/',
      method: 'GET',
    }, function(res) {
      $scope.apps = res;
    });

    $scope.onFileSelected = function(files) {
      for (var i = 0; i < files.length; i++) {
        fileUploader.upload({
          path: '/namespaces/' + $state.params.namespace + '/apps',
          file: files[i]
        })
          .then(success,error);
      }

      function success() {
        $alert({
          type: 'success',
          title: 'Upload success!',
          content: 'The Application has been uploaded successfully!'
        });
        $state.go($state.current, {}, {reload: true});
      }

      function error(err) {
        $alert({
          type: 'danger',
          title: 'Application upload failed!',
          content: err
        });
      }
    };
    $scope.deleteApp = function(app) {
      data.request({
        _cdapNsPath: '/apps/' + app,
        method: 'DELETE'
      }, function(res) {
        if (res.statusCode === 200) {
          $alert({
            type: 'success',
            title: 'Delete Success!',
            content: '<strong>' + app + '</strong> app been deleted successfully'
          });
          // FIXME: Have to avoid $timeout here. Un-necessary.
          $timeout(function() {
            $state.go($state.current, {}, {reload: true});
          }, 1);
        } else {
          $alert({
            type: 'error',
            title: 'Delete failed!',
            content: '<strong>' + app + '</strong> app delete failed.'
          })
        }
      })
    }
  });
