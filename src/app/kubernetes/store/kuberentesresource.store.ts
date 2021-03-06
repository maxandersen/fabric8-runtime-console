import {AbstractStore} from "../../store/entity/entity.store";
import {KubernetesService} from "../service/kubernetes.service";
import {KubernetesResource} from "../model/kubernetesresource.model";
import {Observable} from "rxjs";
import {whenUserLoggedIn} from "../../shared/onlogin.service";
import {Watcher} from "../service/watcher";
import {plural} from "pluralize";

function nameOfResource(resource: any) {
  let obj = resource || {};
  let metadata = obj.metadata || {};
  return metadata.name || "";
}

export abstract class KubernetesResourceStore<T extends KubernetesResource, L extends Array<T>, R extends KubernetesService<T, L>> extends AbstractStore<T, L, R> {
  protected watcher: Watcher;

  constructor(service: R, initialList: L, initialCurrent: T, protected type: { new(): T;}) {
    super(service, initialList, initialCurrent);
  }

  /**
   * Creates a new instance of the resource type from the given data - typically received from a web socket event
   */
  instantiate(resource: any): T {
    if (resource) {
      let item = new this.type();
      item.setResource(resource);
      // lets add the Restangular crack
      return this.service.restangularize(item);
    } else {
      return null;
    }
  }



  update(obj: T): Observable<T> {
    return this.service.update(obj);
  }

  updateResource(obj: T, resource: any): Observable<T> {
    return this.service.updateResource(obj, resource);
  }

  delete(obj: T): Observable<any> {
    return this.service.delete(obj);
  }

  loadAll(): Observable<L> {
    whenUserLoggedIn(() => {
      this.doLoadAll();
    });
    return this.list;
  }

  protected doLoadAll() {
    this._loadId = null;
    this._loading.next(true);
    let listObserver = this.service.list(this.listQueryParams());
    if (this.watcher) {
      // TODO should we recreate as the URL can have changed?
      this.watcher.recreateIfChanged();
    } else {
      this.watcher = this.service.watch();
    }
    let dataStream = this.watcher.dataStream;
    listObserver.combineLatest(dataStream, (l, m) => {
      return this.combineListAndWatchEvent(l, m);
    }).subscribe(list => {
        this._list.next(list);
        this._loading.next(false);
      },
      (error) => {
        console.log('Error retrieving ' + plural(this.kind) + ': ' + error);
        this._loading.next(false);
      });
  }


  /**
   * Lets combine the web socket events with the latest list
   */
  protected combineListAndWatchEvent(array: L, msg: any): L {
    // lets process the added /updated / removed
    if (msg instanceof MessageEvent) {
      let me = msg as MessageEvent;
      let data = me.data;
      if (data) {
        var json = JSON.parse(data);
        if (json) {
          let type = json.type;
          let resource = json.object;
          if (type && resource) {
            switch (type) {
              case "ADDED":
                return this.upsertItem(array, resource);
              case "MODIFIED":
                return this.upsertItem(array, resource);
              case "DELETED":
                return this.deleteItemFromArray(array, resource);
              default:
                console.log("Unknown WebSocket event type " + type + " for " + resource + " on " + this.service.serviceUrl);
            }
          }
        }
      }
    }
    return array;
  }

  protected upsertItem(array: L, resource: any): L {
    let n = nameOfResource(resource);
    if (array && n) {
      for (let i = 0; i < array.length; i++) {
        let item = array[i];
        var name = item.name;
        if (name && name === n) {
          item.setResource(resource);
          //console.log("Updated item " + n);
          return array;
        }
      }

      // now lets add the new item!
      let item = new this.type();
      item.setResource(resource);
      // lets add the Restangular crack
      item = this.service.restangularize(item);
      array.push(item);
      //console.log("Added new item " + n);
    }
    return array;
  }


  protected deleteItemFromArray(array: L, resource: any): L {
    let n = nameOfResource(resource);
    if (array && n) {
      for (var i = 0; i < array.length; i++) {
        let item = array[i];
        var name = item.name;
        if (name && name === n) {
          array.splice(i, 1);
        }
      }
    }
    return array;
  }

  load(id: string): void {
    whenUserLoggedIn(() => {
      super.load(id);
    });
  }

  listQueryParams() {
    return null;
  }
}
